import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { ForgejoConfig } from "./config.js";
import { createServer } from "./server.js";

const BODY_LIMIT = 10 * 1024 * 1024;

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (!raw) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

function hasInitialize(body: unknown): boolean {
  if (Array.isArray(body)) return body.some((msg) => isInitializeRequest(msg));
  return isInitializeRequest(body);
}

function writeJsonRpcError(res: ServerResponse, status: number, code: number, message: string): void {
  if (res.headersSent) return;
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > BODY_LIMIT) {
      throw new Error("payload too large");
    }
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return undefined;
  return JSON.parse(text) as unknown;
}

/**
 * One Streamable HTTP transport per MCP session.
 * A single process-wide transport rejects the second `initialize` with -32600
 * ("Server already initialized"), which is what Grok Web hits on first use
 * after connector setup.
 */
export function createMcpSessionHandler(config: ForgejoConfig) {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  async function closeTransport(transport: StreamableHTTPServerTransport): Promise<void> {
    const sid = transport.sessionId;
    if (sid) transports.delete(sid);
    transport.onclose = undefined;
    await transport.close();
  }

  async function createSession(): Promise<StreamableHTTPServerTransport> {
    const mcp = createServer(config);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sessionId) => {
        transports.set(sessionId, transport);
      },
    });
    // Do not call mcp.close() here: Protocol.close() re-closes the transport and recurses.
    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) transports.delete(sid);
    };
    await mcp.connect(transport);
    return transport;
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = (req.method || "GET").toUpperCase();
    const sessionId = headerValue(req, "mcp-session-id");

    try {
      if (method === "POST") {
        let body: unknown;
        try {
          body = await readJsonBody(req);
        } catch (err) {
          if (err instanceof Error && err.message === "payload too large") {
            writeJsonRpcError(res, 413, -32700, "Payload too large");
            return;
          }
          writeJsonRpcError(res, 400, -32700, "Parse error: Invalid JSON");
          return;
        }

        if (hasInitialize(body)) {
          if (sessionId) {
            const existing = transports.get(sessionId);
            if (existing) await closeTransport(existing);
          }
          const transport = await createSession();
          await transport.handleRequest(req, res, body);
          return;
        }

        const existing = sessionId ? transports.get(sessionId) : undefined;
        if (!existing) {
          writeJsonRpcError(res, 400, -32000, "Bad Request: No valid session ID provided");
          return;
        }
        await existing.handleRequest(req, res, body);
        return;
      }

      if (method === "GET" || method === "DELETE") {
        const existing = sessionId ? transports.get(sessionId) : undefined;
        if (!existing) {
          writeJsonRpcError(res, 400, -32000, "Bad Request: No valid session ID provided");
          return;
        }
        await existing.handleRequest(req, res);
        return;
      }

      writeJsonRpcError(res, 405, -32000, "Method not allowed");
    } catch (err) {
      console.error("Error handling MCP request:", err);
      writeJsonRpcError(res, 500, -32603, "Internal server error");
    }
  }

  async function closeAll(): Promise<void> {
    const all = [...transports.values()];
    transports.clear();
    await Promise.all(
      all.map(async (t) => {
        t.onclose = undefined;
        await t.close();
      })
    );
  }

  return { handle, closeAll };
}
