import { createServer as createHttpServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createMcpSessionHandler } from "../mcp-http.js";

const INIT = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test", version: "0.0.0" },
  },
};

const TOOLS_LIST = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/list",
  params: {},
};

let server: Server | undefined;
let closeAll: (() => Promise<void>) | undefined;

async function listen(): Promise<number> {
  const handler = createMcpSessionHandler({
    baseUrl: "https://forgejo.example.com",
    token: "test-token",
  });
  closeAll = handler.closeAll;
  server = createHttpServer((req, res) => {
    void handler.handle(req, res);
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  return addr.port;
}

async function rpc(
  port: number,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; json: Record<string, unknown>; sessionId: string | null }> {
  const res = await fetch(`http://127.0.0.1:${port}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    json: (await res.json()) as Record<string, unknown>,
    sessionId: res.headers.get("mcp-session-id"),
  };
}

afterEach(async () => {
  await closeAll?.();
  closeAll = undefined;
  await new Promise<void>((resolve, reject) => {
    if (!server) return resolve();
    server.close((err) => (err ? reject(err) : resolve()));
    server = undefined;
  });
});

describe("MCP HTTP sessions", () => {
  it("accepts a second initialize instead of returning -32600", async () => {
    const port = await listen();
    const first = await rpc(port, INIT);
    expect(first.status).toBe(200);
    expect(first.json.error).toBeUndefined();
    expect(first.sessionId).toBeTruthy();

    const second = await rpc(port, { ...INIT, id: 3 });
    expect(second.status).toBe(200);
    expect(second.json.error).toBeUndefined();
    expect((second.json as { error?: { code?: number } }).error?.code).not.toBe(-32600);
    expect(second.sessionId).toBeTruthy();
    expect(second.sessionId).not.toBe(first.sessionId);
  });

  it("serves tools/list on the session created by initialize", async () => {
    const port = await listen();
    const init = await rpc(port, INIT);
    const listed = await rpc(port, TOOLS_LIST, { "mcp-session-id": init.sessionId! });
    expect(listed.status).toBe(200);
    expect(listed.json.error).toBeUndefined();
    const result = listed.json.result as { tools?: unknown[] };
    expect(Array.isArray(result.tools)).toBe(true);
    expect(result.tools!.length).toBeGreaterThan(0);
  });

  it("replaces a session when initialize is sent with an existing session id", async () => {
    const port = await listen();
    const first = await rpc(port, INIT);
    const replaced = await rpc(port, { ...INIT, id: 4 }, { "mcp-session-id": first.sessionId! });
    expect(replaced.status).toBe(200);
    expect(replaced.json.error).toBeUndefined();
    expect(replaced.sessionId).toBeTruthy();

    const listed = await rpc(port, TOOLS_LIST, { "mcp-session-id": replaced.sessionId! });
    expect(listed.json.error).toBeUndefined();
  });
});
