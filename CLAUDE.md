# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
npm run build          # Compile TypeScript to dist/
npm run dev            # Run stdio server (tsx, no build needed)
npm run dev:http       # Run HTTP server on port 3000
npm test               # Run all tests
npm run test:watch     # Watch mode
npx vitest run src/__tests__/tools/repository.test.ts  # Run a single test file
npm run lint           # ESLint
```

## Architecture

This is an MCP (Model Context Protocol) server for Forgejo/Gitea instances, providing 103 tools across 6 categories. It has two transport modes: stdio (for Claude Code/Desktop) and HTTP (for remote access).

### Request Flow

```
Entry point (index.ts or http.ts)
  → config.ts (loads env vars / CLI args, validates URL for SSRF)
  → server.ts (creates McpServer, registers all tool groups)
  → tools/*.ts (each tool calls ForgejoClient methods)
  → client.ts (wraps fetch with token auth, hits /api/v1)
```

### Key Modules

- **`server.ts`** — Factory that creates `McpServer` and calls six `register*Tools()` functions
- **`client.ts`** — `ForgejoClient` class with `get/post/patch/put/delete/getRaw` methods. Errors are wrapped in `ForgejoApiError` with sanitized URLs (no token leakage)
- **`config.ts`** — `resolveConfig()` merges CLI args > env vars > defaults. `validateBaseUrl()` blocks SSRF (cloud metadata IPs, private ranges)
- **`validation.ts`** — Centralized Zod schemas (`zOwner`, `zRepo`, `zFilePath`, `zPage`, `zLimit`, etc.) shared across all tool files
- **`tools/helpers.ts`** — `formatResponse(data)` and `formatError(err)` produce the MCP content format
- **`tools/file-content.ts`** — Encode/decode Contents API base64 so MCP clients send and receive UTF-8 text (GitHub MCP pattern)
- **`http.ts`** — HTTP transport with optional Bearer auth (`FORGEJO_MCP_API_KEY`), OAuth 2.1 for browser MCP clients, security headers, `/health` endpoint
- **`rate-limit.ts`** — Per-IP token bucket (burst 50, 1000/min) plus a separate initialize handshake bucket (24/10s). Health, CORS preflight, and OAuth discovery are exempt; 429 includes `Retry-After`.
- **`mcp-http.ts`** — Per-session Streamable HTTP handler (new transport on each `initialize`)
- **`oauth.ts`** — Embedded OAuth 2.1 AS (PKCE, DCR, RFC 8414/9728 metadata, HMAC-signed tokens). Gates `/mcp`; outbound Forgejo calls still use `FORGEJO_TOKEN`.

### Tool Registration Pattern

Every tool file exports a single `register*Tools(server, client)` function. Each tool follows this structure:

```typescript
server.tool(
  "tool_name",           // snake_case identifier
  "Description",         // shown in MCP UI
  { owner: zOwner, repo: zRepo, ...params },  // Zod schemas (raw shape, NOT wrapped in z.object)
  async (params) => {
    const { owner, repo, ...query } = params;
    const result = await client.get(`/repos/${owner}/${repo}`, query);
    return formatResponse(result);
  }
);
```

The Zod schemas are passed as a raw object shape — the MCP SDK wraps them in `z.object()` internally.

### Testing Pattern

Tests mock the `ForgejoClient` methods and access registered tool handlers directly:

```typescript
const client = { get: vi.fn(), post: vi.fn(), ... } as unknown as ForgejoClient;
const server = new McpServer({ name: "test", version: "0.0.0" });
registerRepositoryTools(server, client);
const tool = (server as any)._registeredTools["search_repos"];
const result = await tool.handler({ q: "test" });
```

Note: handlers are at `._registeredTools["name"].handler` (not `.callback`).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FORGEJO_URL` | Yes | Base URL of Forgejo/Gitea instance |
| `FORGEJO_TOKEN` | Yes | API token |
| `FORGEJO_MCP_API_KEY` | No | Bearer token for HTTP endpoint auth and OAuth consent password |
| `OAUTH_PUBLIC_URL` | No | Public HTTPS origin for OAuth metadata (tunnel / reverse proxy) |
| `PORT` | No | HTTP port (default: 3000) |
| `RATE_LIMIT_MAX` | No | RPC refill per window (default: 1000; `0` disables) |
| `RATE_LIMIT_WINDOW_MS` | No | RPC window in ms (default: 60000) |
| `RATE_LIMIT_BURST` | No | Instant RPC burst (default: 50) |
| `RATE_LIMIT_HANDSHAKE_BURST` | No | `initialize` burst (default: 24 per 10s) |

## Conventions

- Tool names use snake_case with domain prefixes: `list_issues`, `create_issue`, `admin_create_user`
- Path params are destructured from query params: `const { owner, repo, ...query } = params`
- All user-supplied identifiers (owner, repo, branch) are validated against `PATH_SEGMENT_REGEX` to prevent path traversal
- File paths block `..`, leading `/`, and backslashes
- Pagination is bounded: page ≥ 1, limit 1–50
- File content parameters (`create_file`, `update_file`) expect plain UTF-8 text; the server base64-encodes for the Forgejo Contents API. `get_file_contents` decodes text files (`encoding: "utf-8"`) and leaves binary as base64.
- The `ForgejoApiError` class never includes the full URL in messages to avoid leaking tokens
