import { describe, it, expect, vi, afterEach } from "vitest";
import {
  RateLimiter,
  parseRateLimitInt,
  skipHttpRateLimit,
  DEFAULT_RATE_LIMIT_MAX,
} from "../rate-limit.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("RateLimiter", () => {
  it("allows up to maxRequests then rejects with Retry-After", () => {
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
    expect(denied.retryAfterSec).toBe(10);
  });

  it("tracks keys independently", () => {
    const limiter = new RateLimiter(1, 60_000);
    expect(limiter.isAllowed("a").allowed).toBe(true);
    expect(limiter.isAllowed("b").allowed).toBe(true);
    expect(limiter.isAllowed("a").allowed).toBe(false);
    expect(limiter.isAllowed("b").allowed).toBe(false);
  });

  it("resets after the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const limiter = new RateLimiter(1, 1000);

    expect(limiter.isAllowed("ip").allowed).toBe(true);
    expect(limiter.isAllowed("ip").allowed).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(limiter.isAllowed("ip").allowed).toBe(true);
  });

  it("maxRequests 0 disables limiting", () => {
    const limiter = new RateLimiter(0, 1000);
    for (let i = 0; i < 50; i++) {
      expect(limiter.isAllowed("ip").allowed).toBe(true);
    }
  });

  it("cleanup removes expired entries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const limiter = new RateLimiter(1, 1000);
    limiter.isAllowed("stale");
    vi.advanceTimersByTime(1001);
    limiter.cleanup();
    // New window after cleanup still allows the first request
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
