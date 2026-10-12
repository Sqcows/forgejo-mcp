#!/usr/bin/env node

import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { envInt, parseCliArgs, resolveConfig } from "./config.js";
import { createServer, SERVER_VERSION } from "./server.js";

/**
 * Sessions kept open at once. Every session owns a server instance (about 4 MB
 * with all tool areas enabled), so beyond this the least recently used one is
 * closed; its client is told the session is gone (404) and starts a new one.
 */
const MAX_SESSIONS = 32;

/**
 * Largest request body accepted. The biggest legitimate call is a file upload
 * (create_file allows 10 MB of base64 content) plus its JSON envelope; the SDK
 * transport would otherwise buffer a body of any size.
 */
const MAX_BODY_BYTES = 16 * 1024 * 1024;

/** How long to wait for open connections to close on SIGTERM/SIGINT before exiting anyway */
const SHUTDOWN_GRACE_MS = 5_000;

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

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function sendRpcError(res: ServerResponse, status: number, code: number, message: string): void {
  sendJson(res, status, { jsonrpc: "2.0", error: { code, message }, id: null });
}

class BodyTooLargeError extends Error {}

/** Read and parse a JSON request body, refusing one larger than MAX_BODY_BYTES */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  if (Number(req.headers["content-length"]) > MAX_BODY_BYTES) {
    throw new BodyTooLargeError();
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      throw new BodyTooLargeError();
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** The request path, or undefined when the request target is not a valid URL (e.g. "//") */
function requestPath(req: IncomingMessage): string | undefined {
  try {
    return new URL(req.url || "/", "http://localhost").pathname;
  } catch {
    return undefined;
  }
}

/** Compare two strings in constant time. Hashing first gives both sides the same length. */
function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * Browsers send an Origin header with the requests a web page makes; MCP
 * clients do not. When no API key is configured, refusing every origin that is
 * not local stops a page from driving this server through DNS rebinding, where
 * the attacker's hostname is pointed at 127.0.0.1 so that the page and this
 * server share an origin. With an API key the page cannot authenticate anyway.
 */
function isAllowedOrigin(origin: string | undefined): boolean {
  if (origin === undefined) {
    return true;
  }
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

async function main() {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const config = resolveConfig(cliArgs);
  const port = cliArgs.port || envInt("PORT", 3000, 1);

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
  const expectedAuth = apiKey ? `Bearer ${apiKey}` : undefined;

  const rateLimitMax = envInt("RATE_LIMIT_MAX", 100, 1);
  const rateLimitWindowMs = envInt("RATE_LIMIT_WINDOW_MS", 60_000, 1);
  const rateLimiter = new RateLimiter(rateLimitMax, rateLimitWindowMs);

  // Cleanup rate limiter every 5 minutes
  setInterval(() => rateLimiter.cleanup(), 300_000).unref();

  // One transport (and server) per client session, least recently used first.
  // A single shared transport would only ever accept one `initialize`.
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  async function openSession(): Promise<StreamableHTTPServerTransport> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        if (sessions.size >= MAX_SESSIONS) {
          const [oldestId, oldest] = sessions.entries().next().value as [string, StreamableHTTPServerTransport];
          sessions.delete(oldestId);
          void oldest.close();
        }
        sessions.set(sessionId, transport);
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) {
        sessions.delete(transport.sessionId);
      }
    };
    await createServer(config).connect(transport);
    return transport;
  }

  async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const header = req.headers["mcp-session-id"];
    const sessionId = Array.isArray(header) ? header[0] : header;

    if (sessionId !== undefined && !sessions.has(sessionId)) {
      sendRpcError(res, 404, -32001, "Session not found");
      return;
    }
    if (sessionId === undefined && req.method !== "POST") {
      sendRpcError(res, 400, -32000, "Bad Request: Mcp-Session-Id header is required");
      return;
    }

    let body: unknown;
    if (req.method === "POST") {
      try {
        body = await readJsonBody(req);
      } catch (error) {
        if (error instanceof BodyTooLargeError) {
          res.setHeader("Connection", "close");
          sendRpcError(res, 413, -32600, "Request body too large");
        } else {
          sendRpcError(res, 400, -32700, "Parse error: Invalid JSON");
        }
        return;
      }
    }

    let transport: StreamableHTTPServerTransport;
    if (sessionId !== undefined) {
      transport = sessions.get(sessionId) as StreamableHTTPServerTransport;
      // Re-insert so the map stays ordered by last use
      sessions.delete(sessionId);
      sessions.set(sessionId, transport);
    } else if (isInitializeRequest(body)) {
      transport = await openSession();
    } else {
      // Only `initialize` may arrive without a session; answering here avoids
      // building a server (every tool registered) for a request that cannot use it
      sendRpcError(res, 400, -32000, "Bad Request: Mcp-Session-Id header is required");
      return;
    }

    await transport.handleRequest(req, res, body);
  }

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Security headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");

    // Rate limiting
    const clientIp = req.socket.remoteAddress || "unknown";
    if (!rateLimiter.isAllowed(clientIp)) {
      sendJson(res, 429, { error: "Too many requests" });
      return;
    }

    const pathname = requestPath(req);
    if (pathname === undefined) {
      sendJson(res, 400, { error: "Bad request" });
      return;
    }

    if (pathname === "/mcp") {
      // Authentication check for MCP endpoints
      if (expectedAuth) {
        if (!safeEqual(req.headers.authorization ?? "", expectedAuth)) {
          sendJson(res, 401, { error: "Unauthorized. Provide Bearer token via Authorization header." });
          return;
        }
      } else if (!isAllowedOrigin(req.headers.origin)) {
        sendJson(res, 403, { error: "Forbidden origin. Set FORGEJO_MCP_API_KEY to allow browser clients." });
        return;
      }

      await handleMcp(req, res);
    } else if (pathname === "/health") {
      sendJson(res, 200, { status: "ok", version: SERVER_VERSION });
    } else {
      sendJson(res, 404, { error: "Not found" });
    }
  }

  const httpServer = createHttpServer((req, res) => {
    // A rejection here would otherwise be unhandled and take the process down
    handleRequest(req, res).catch((error) => {
      console.error("Request failed:", error);
      if (res.headersSent) {
        res.destroy();
      } else {
        sendJson(res, 500, { error: "Internal server error" });
      }
    });
  });

  httpServer.listen(port, () => {
    console.error(`Forgejo MCP server (HTTP) listening on port ${port}`);
    console.error(`  MCP endpoint: http://localhost:${port}/mcp`);
    console.error(`  Health check: http://localhost:${port}/health`);
    console.error(`  Connected to: ${config.baseUrl}`);
    console.error(`  Authentication: ${apiKey ? "enabled (Bearer token)" : "DISABLED"}`);
    console.error(`  Rate limiting: ${rateLimitMax} requests per ${rateLimitWindowMs / 1000}s per IP`);
  });

  // Node ignores SIGTERM when it runs as PID 1 (the container default) unless a
  // handler is installed, which would leave `docker stop` waiting to SIGKILL it.
  const shutdown = () => {
    for (const transport of sessions.values()) {
      void transport.close();
    }
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
