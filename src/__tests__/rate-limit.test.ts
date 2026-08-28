import { describe, it, expect, vi, afterEach } from "vitest";
import {
  RateLimiter,
  parseRateLimitInt,
  skipHttpRateLimit,
  isMcpHandshake,
  classifyHttpRateLimit,
  DEFAULT_RATE_LIMIT_MAX,
} from "../rate-limit.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("RateLimiter", () => {
  it("allows a burst then rejects with a short Retry-After", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const limiter = new RateLimiter(3, 10_000);

    expect(limiter.isAllowed("ip").allowed).toBe(true);
    expect(limiter.isAllowed("ip").allowed).toBe(true);
    const lastOk = limiter.isAllowed("ip");
    expect(lastOk.allowed).toBe(true);
    expect(lastOk.remaining).toBe(0);

    const denied = limiter.isAllowed("ip");
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    // Token bucket: one token refills in window/max, not the whole window.
    expect(denied.retryAfterSec).toBe(4);
  });

  it("tracks keys independently", () => {
    const limiter = new RateLimiter(1, 60_000);
    expect(limiter.isAllowed("a").allowed).toBe(true);
    expect(limiter.isAllowed("b").allowed).toBe(true);
    expect(limiter.isAllowed("a").allowed).toBe(false);
    expect(limiter.isAllowed("b").allowed).toBe(false);
  });

  it("refills tokens over time so a 429 is not a full-minute lockout", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const limiter = new RateLimiter(1, 1000);

    expect(limiter.isAllowed("ip").allowed).toBe(true);
    expect(limiter.isAllowed("ip").allowed).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(limiter.isAllowed("ip").allowed).toBe(true);
  });

  it("allows burst above the sustained rate", () => {
    const limiter = new RateLimiter(10, 60_000, 4);
    expect(limiter.isAllowed("ip").allowed).toBe(true);
    expect(limiter.isAllowed("ip").allowed).toBe(true);
    expect(limiter.isAllowed("ip").allowed).toBe(true);
    expect(limiter.isAllowed("ip").allowed).toBe(true);
    expect(limiter.isAllowed("ip").allowed).toBe(false);
  });

  it("does not drain tokens further on a denied request", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const limiter = new RateLimiter(1, 2000);
    limiter.isAllowed("ip");
    const first = limiter.isAllowed("ip");
    const second = limiter.isAllowed("ip");
    expect(first.allowed).toBe(false);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterSec).toBe(first.retryAfterSec);
  });

  it("maxRequests 0 disables limiting", () => {
    const limiter = new RateLimiter(0, 1000);
    for (let i = 0; i < 50; i++) {
      expect(limiter.isAllowed("ip").allowed).toBe(true);
    }
  });

  it("cleanup removes idle entries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const limiter = new RateLimiter(1, 1000);
    limiter.isAllowed("stale");
    vi.advanceTimersByTime(130_000);
    limiter.cleanup();
    // Idle bucket is gone; a new one starts full.
    expect(limiter.isAllowed("stale").allowed).toBe(true);
  });
});

describe("parseRateLimitInt", () => {
  it("returns fallback for missing, empty, or invalid values", () => {
    expect(parseRateLimitInt(undefined, 1000)).toBe(1000);
    expect(parseRateLimitInt("", 1000)).toBe(1000);
    expect(parseRateLimitInt("abc", 1000)).toBe(1000);
    expect(parseRateLimitInt("-5", 1000)).toBe(1000);
  });

  it("accepts 0 (unlimited) and positive integers", () => {
    expect(parseRateLimitInt("0", 1000)).toBe(0);
    expect(parseRateLimitInt("1000", 100)).toBe(1000);
    expect(parseRateLimitInt("50", DEFAULT_RATE_LIMIT_MAX)).toBe(50);
  });
});

describe("skipHttpRateLimit", () => {
  it("skips CORS preflight, health, and OAuth discovery", () => {
    expect(skipHttpRateLimit("OPTIONS", "/mcp")).toBe(true);
    expect(skipHttpRateLimit("GET", "/health")).toBe(true);
    expect(skipHttpRateLimit("GET", "/.well-known/oauth-authorization-server")).toBe(true);
    expect(skipHttpRateLimit("GET", "/.well-known/oauth-protected-resource/mcp")).toBe(true);
  });

  it("does not skip MCP tool calls or OAuth token exchange", () => {
    expect(skipHttpRateLimit("POST", "/mcp")).toBe(false);
    expect(skipHttpRateLimit("GET", "/mcp")).toBe(false);
    expect(skipHttpRateLimit("POST", "/oauth/token")).toBe(false);
    expect(skipHttpRateLimit("GET", "/oauth/authorize")).toBe(false);
  });
});

describe("isMcpHandshake / classifyHttpRateLimit", () => {
  it("treats POST /mcp without a session id as initialize", () => {
    expect(isMcpHandshake("POST", "/mcp", undefined)).toBe(true);
    expect(isMcpHandshake("POST", "/mcp/", "")).toBe(true);
    expect(classifyHttpRateLimit("POST", "/mcp")).toBe("handshake");
  });

  it("treats POST /mcp with a session id as an RPC, not a handshake", () => {
    expect(isMcpHandshake("POST", "/mcp", "abc")).toBe(false);
    expect(classifyHttpRateLimit("POST", "/mcp", "abc")).toBe("rpc");
  });

  it("does not treat GET/DELETE session traffic as a handshake", () => {
    expect(isMcpHandshake("GET", "/mcp", undefined)).toBe(false);
    expect(isMcpHandshake("DELETE", "/mcp", "abc")).toBe(false);
    expect(classifyHttpRateLimit("GET", "/mcp", "abc")).toBe("rpc");
  });

  it("still skips health and discovery before handshake classification", () => {
    expect(classifyHttpRateLimit("GET", "/health")).toBe("skip");
    expect(classifyHttpRateLimit("OPTIONS", "/mcp")).toBe("skip");
    expect(classifyHttpRateLimit("GET", "/.well-known/oauth-authorization-server")).toBe("skip");
  });
});
