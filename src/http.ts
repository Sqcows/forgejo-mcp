#!/usr/bin/env node

import { createServer as createHttpServer } from "node:http";
import { parseCliArgs, resolveConfig } from "./config.js";
import { handleOAuthRoutes, isValidBearer, resolveIssuer, writeUnauthorized } from "./oauth.js";
import { createMcpSessionHandler } from "./mcp-http.js";

/** Simple in-memory rate limiter per IP */
class RateLimiter {
  private requests = new Map<string, { count: number; resetAt: number }>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = 100, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(ip: string): boolean {
    const now = Date.now();
    const entry = this.requests.get(ip);

    if (!entry || now > entry.resetAt) {
      this.requests.set(ip, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    entry.count++;
    return entry.count <= this.maxRequests;
  }

  /** Periodically clean up expired entries */
  cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.requests) {
      if (now > entry.resetAt) {
        this.requests.delete(ip);
      }
    }
  }
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
  const rateLimiter = new RateLimiter(
    parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
    parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10)
  );

  // Cleanup rate limiter every 5 minutes
  setInterval(() => rateLimiter.cleanup(), 300_000).unref();

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const clientIp = req.socket.remoteAddress || "unknown";

    // Rate limiting
    if (!rateLimiter.isAllowed(clientIp)) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Too many requests" }));
      return;
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
    console.error(`  Rate limiting: ${process.env.RATE_LIMIT_MAX || "100"} req/min per IP`);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
