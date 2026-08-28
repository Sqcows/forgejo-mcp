/** In-memory fixed-window rate limiter, keyed by client identity (IP). */

export const DEFAULT_RATE_LIMIT_MAX = 1000;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export class RateLimiter {
  private requests = new Map<string, { count: number; resetAt: number }>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = DEFAULT_RATE_LIMIT_MAX, windowMs = DEFAULT_RATE_LIMIT_WINDOW_MS) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(key: string, now = Date.now()): RateLimitResult {
    if (this.maxRequests === 0) {
      return { allowed: true, remaining: 0, retryAfterSec: 0 };
    }

    const entry = this.requests.get(key);

    if (!entry || now >= entry.resetAt) {
      this.requests.set(key, { count: 1, resetAt: now + this.windowMs });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        retryAfterSec: 0,
      };
    }

    entry.count++;
    if (entry.count <= this.maxRequests) {
      return {
        allowed: true,
        remaining: this.maxRequests - entry.count,
        retryAfterSec: 0,
      };
    }

    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  /** Periodically clean up expired entries */
  cleanup(now = Date.now()): void {
    for (const [key, entry] of this.requests) {
      if (now >= entry.resetAt) {
        this.requests.delete(key);
      }
    }
  }
}

/** Parse a positive integer env value; 0 disables the limiter. Invalid values use fallback. */
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
 * consume the MCP tool-call budget (Grok Web file reads live on POST /mcp).
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
