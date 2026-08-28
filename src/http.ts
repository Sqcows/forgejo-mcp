#!/usr/bin/env node

import { createServer as createHttpServer, type IncomingMessage } from "node:http";
import { parseCliArgs, resolveConfig } from "./config.js";
import { handleOAuthRoutes, isValidBearer, resolveIssuer, writeUnauthorized } from "./oauth.js";
import { createMcpSessionHandler } from "./mcp-http.js";
import {
  RateLimiter,
  parseRateLimitInt,
  classifyHttpRateLimit,
  DEFAULT_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_RATE_LIMIT_BURST,
  DEFAULT_HANDSHAKE_BURST,
  DEFAULT_HANDSHAKE_WINDOW_MS,
} from "./rate-limit.js";

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name];
  if (!raw) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value || undefined;
}

async function main() {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const config = resolveConfig(cliArgs);
  const port = cliArgs.port || parseInt(process.env.PORT || "3000", 10);

  // Optional bearer token for HTTP endpoint authentication
  const apiKey = process.env.FORGEJO_MCP_API_KEY;
  if (!apiKey) {
    console.error(
      "WARNING: No FORGEJO_MCP_API_KEY set. The HTTP endpoint is UNAUTHENTICATED.\n" +
      "  Anyone who can reach this server will have full access to your Forgejo token's permissions.\n" +
      "  Set FORGEJO_MCP_API_KEY to require Bearer token authentication.\n" +
      "  Only run unauthenticated on localhost or behind a reverse proxy with its own auth."
    );
  }

  const mcpHandler = createMcpSessionHandler(config);
  const rateLimitMax = parseRateLimitInt(process.env.RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX);
  const rateLimitWindowMs = parseRateLimitInt(
    process.env.RATE_LIMIT_WINDOW_MS,
    DEFAULT_RATE_LIMIT_WINDOW_MS
  ) || DEFAULT_RATE_LIMIT_WINDOW_MS;
  const rateLimitBurst =
    parseRateLimitInt(process.env.RATE_LIMIT_BURST, DEFAULT_RATE_LIMIT_BURST) || DEFAULT_RATE_LIMIT_BURST;
  const handshakeBurst =
    parseRateLimitInt(process.env.RATE_LIMIT_HANDSHAKE_BURST, DEFAULT_HANDSHAKE_BURST) ||
    DEFAULT_HANDSHAKE_BURST;
  const handshakeWindowMs =
    parseRateLimitInt(process.env.RATE_LIMIT_HANDSHAKE_WINDOW_MS, DEFAULT_HANDSHAKE_WINDOW_MS) ||
    DEFAULT_HANDSHAKE_WINDOW_MS;
  const rpcLimiter = new RateLimiter(rateLimitMax, rateLimitWindowMs, rateLimitBurst);
  // Separate bucket so parallel Grok Web initialize POSTs cannot 429 the RPC budget.
  const handshakeLimiter = new RateLimiter(handshakeBurst, handshakeWindowMs, handshakeBurst);

  // Cleanup rate limiter every 5 minutes
  setInterval(() => {
    rpcLimiter.cleanup();
    handshakeLimiter.cleanup();
  }, 300_000).unref();

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const clientIp = req.socket.remoteAddress || "unknown";
    const sessionId = headerValue(req, "mcp-session-id");
    const kind = classifyHttpRateLimit(req.method || "GET", url.pathname, sessionId);

    // Rate limiting: initialize (no session id) uses a short burst bucket so
    // parallel call_connected_tool handshakes are not a 60s lockout.
    if (kind !== "skip" && rateLimitMax !== 0) {
      const limiter = kind === "handshake" ? handshakeLimiter : rpcLimiter;
      const limit = limiter.isAllowed(clientIp);
      if (!limit.allowed) {
        res.writeHead(429, {
          "Content-Type": "application/json",
          "Retry-After": String(limit.retryAfterSec),
        });
        res.end(JSON.stringify({ error: "Too many requests", retry_after: limit.retryAfterSec }));
        return;
      }
    }

    // Security headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");

    const issuer = resolveIssuer(req.headers, process.env.OAUTH_PUBLIC_URL);

    if (apiKey && await handleOAuthRoutes(req, res, url, { secret: apiKey, issuer })) {
      return;
    }

    if (url.pathname === "/mcp" && req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id",
        "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
      });
      res.end();
      return;
    }

    // Authentication check for MCP endpoints
    if (url.pathname === "/mcp" && apiKey) {
      const authHeader = req.headers.authorization;
      const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
      const presented = (raw ?? "").replace(/^Bearer\s+/i, "");
      if (!isValidBearer(apiKey, presented)) {
        writeUnauthorized(res, issuer);
        return;
      }
    }

    if (url.pathname === "/mcp") {
      await mcpHandler.handle(req, res);
    } else if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", version: "0.1.0" }));
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });

  httpServer.listen(port, () => {
    console.error(`Forgejo MCP server (HTTP) listening on port ${port}`);
    console.error(`  MCP endpoint: http://localhost:${port}/mcp`);
    console.error(`  Health check: http://localhost:${port}/health`);
    console.error(`  Connected to: ${config.baseUrl}`);
    console.error(`  Authentication: ${apiKey ? "enabled (Bearer token + OAuth)" : "DISABLED"}`);
    if (apiKey) {
      const publicUrl = process.env.OAUTH_PUBLIC_URL?.replace(/\/+$/, "");
      console.error(`  OAuth issuer: ${publicUrl || "(derived from Host / X-Forwarded-* headers)"}`);
      console.error(`  OAuth consent password: FORGEJO_MCP_API_KEY`);
    }
    console.error(
      rateLimitMax === 0
        ? "  Rate limiting: disabled"
        : `  Rate limiting: ${rateLimitBurst} burst / ${rateLimitMax} per ${rateLimitWindowMs}ms per IP` +
          `; initialize ${handshakeBurst} per ${handshakeWindowMs}ms`
    );
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
