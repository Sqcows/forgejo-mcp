/** In-memory token-bucket rate limiter, keyed by client identity (IP). */

export const DEFAULT_RATE_LIMIT_MAX = 1000;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
/** Instant parallel RPCs (tool calls) before refill applies. */
export const DEFAULT_RATE_LIMIT_BURST = 50;
/**
 * Grok Web opens a Streamable HTTP session per tool call. Parallel tools
 * therefore POST several `initialize` handshakes at once. Those must not
 * share the RPC budget or a 429 Retry-After of a full minute.
 */
export const DEFAULT_HANDSHAKE_BURST = 24;
export const DEFAULT_HANDSHAKE_WINDOW_MS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export type RateLimitKind = "skip" | "handshake" | "rpc";

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private maxRequests: number;
  private windowMs: number;
  private burst: number;

  constructor(
    maxRequests = DEFAULT_RATE_LIMIT_MAX,
    windowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
    burst = maxRequests
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.burst = burst > 0 ? burst : maxRequests;
  }

  isAllowed(key: string, now = Date.now()): RateLimitResult {
    if (this.maxRequests === 0) {
      return { allowed: true, remaining: 0, retryAfterSec: 0 };
    }

    let entry = this.buckets.get(key);
    if (!entry) {
      entry = { tokens: this.burst, updatedAt: now };
      this.buckets.set(key, entry);
    } else {
      const elapsed = Math.max(0, now - entry.updatedAt);
      const refill = this.windowMs > 0 ? (elapsed / this.windowMs) * this.maxRequests : 0;
      entry.tokens = Math.min(this.burst, entry.tokens + refill);
      entry.updatedAt = now;
    }

    if (entry.tokens >= 1) {
      entry.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(entry.tokens),
        retryAfterSec: 0,
      };
    }

    const need = 1 - entry.tokens;
    const retryAfterSec =
      this.maxRequests > 0 && this.windowMs > 0
        ? Math.max(1, Math.ceil((need / this.maxRequests) * this.windowMs / 1000))
        : 1;

    return { allowed: false, remaining: 0, retryAfterSec };
  }

  /** Drop idle buckets so the map cannot grow without bound. */
  cleanup(now = Date.now()): void {
    const idleMs = Math.max(this.windowMs, DEFAULT_RATE_LIMIT_WINDOW_MS) * 2;
    for (const [key, entry] of this.buckets) {
      if (now - entry.updatedAt >= idleMs) {
        this.buckets.delete(key);
      }
    }
  }
}

/** Parse a non-negative integer env value; 0 disables the limiter. Invalid values use fallback. */
export function parseRateLimitInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw === "") {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return n;
}

/**
 * CORS preflight, health checks, and OAuth discovery are chatty and must not
 * consume the MCP tool-call budget.
 */
export function skipHttpRateLimit(method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  if (m === "OPTIONS") {
    return true;
  }
  if (pathname === "/health" || pathname === "/health/") {
    return true;
  }
  return pathname === "/.well-known" || pathname.startsWith("/.well-known/");
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/**
 * Streamable HTTP `initialize` has no `Mcp-Session-Id`. Grok Web's
 * call_connected_tool uses a fresh session per tool, so these POSTs are
 * handshakes, not file reads.
 */
export function isMcpHandshake(
  method: string,
  pathname: string,
  sessionId: string | undefined
): boolean {
  if (method.toUpperCase() !== "POST") {
    return false;
  }
  if (normalizePath(pathname) !== "/mcp") {
    return false;
  }
  return !sessionId;
}

export function classifyHttpRateLimit(
  method: string,
  pathname: string,
  sessionId?: string
): RateLimitKind {
  if (skipHttpRateLimit(method, pathname)) {
    return "skip";
  }
  if (isMcpHandshake(method, pathname, sessionId)) {
    return "handshake";
  }
  return "rpc";
}
