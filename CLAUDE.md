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

This is an MCP (Model Context Protocol) server for Forgejo/Gitea instances, providing 457 tools across 9 categories. It has two transport modes: stdio (for Claude Code/Desktop) and HTTP (for remote access).

### Request Flow

```
Entry point (index.ts or http.ts)
  → config.ts (loads env vars / CLI args, validates URL for SSRF)
  → server.ts (creates McpServer, registers all tool groups)
  → tools/*.ts (each tool calls ForgejoClient methods)
  → client.ts (wraps fetch with token auth, hits /api/v1)
```

### Key Modules

- **`server.ts`** — Factory that creates `McpServer` and calls nine `register*Tools()` functions (one per file in `tools/`). In lazy mode (`--lazy` / `FORGEJO_LAZY_TOOLS`, off by default) it registers every tool disabled plus a `load_tool_area` tool that enables an area's tools and sends `notifications/tools/list_changed`; this only works in clients that refetch the tool list mid-session
- **`client.ts`** — `ForgejoClient` class with `get/post/patch/put/delete/getRaw` methods. Errors are wrapped in `ForgejoApiError` with sanitized URLs (no token leakage). Refuses request paths containing `.`/`..` segments or unencoded `?`, `#`, or backslashes
- **`compact.ts`** — Wraps the SDK's `tools/list` handler to strip validation-only schema keywords and boilerplate from the tool list sent to clients (saves context; Zod validation is unchanged). The compacted list is cached by a key that `server.ts` supplies per request, which must identify the tools currently enabled (in lazy mode this includes the loaded areas)
- **`config.ts`** — `resolveConfig()` merges CLI args > env vars > defaults. Tool areas (`TOOL_AREAS`) can be disabled with `--disable-<area>` / `--disable a,b` or `FORGEJO_DISABLED_AREAS`; `server.ts` skips those groups. `validateBaseUrl()` blocks SSRF (cloud metadata IPs, private ranges)
- **`validation.ts`** — Centralized Zod schemas (`zOwner`, `zRepo`, `zFilePath`, `zPage`, `zLimit`, etc.) shared across all tool files
- **`tools/helpers.ts`** — `formatResponse(data)` and `formatError(err)` produce the MCP content format; `encodePath(value)` percent-encodes a slash-separated value for use in a request path; `READ_ONLY_TOOL` / `ADDITIVE_TOOL` / `DESTRUCTIVE_TOOL` are the shared MCP `ToolAnnotations` presets passed at registration
- **`http.ts`** — HTTP transport: one `McpServer` + transport per client session (LRU-capped), `RateLimiter` class, optional Bearer auth (`FORGEJO_MCP_API_KEY`), `Origin` check when unauthenticated, security headers, `/health` endpoint

### Tool Registration Pattern

Every tool file exports a single `register*Tools(server, client)` function. Each tool follows this structure:

```typescript
server.tool(
  "tool_name",           // snake_case identifier
  "Description",         // shown in MCP UI
  { owner: zOwner, repo: zRepo, ...params },  // Zod schemas (raw shape, NOT wrapped in z.object)
  READ_ONLY_TOOL,        // annotations preset (see below)
  async (params) => {
    const { owner, repo, ...query } = params;
    const result = await client.get(`/repos/${owner}/${repo}`, query);
    return formatResponse(result);
  }
);
```

The Zod schemas are passed as a raw object shape — the MCP SDK wraps them in `z.object()` internally.

### Tool annotations

Every registration passes one of the `ToolAnnotations` presets from `tools/helpers.ts` (all four hints are always set explicitly, because unset hints fall back to worst-case protocol defaults):

- `READ_ONLY_TOOL` — tools that never modify Forgejo state (GET/getRaw tools, plus `render_markdown`/`render_markup`, which are read-only POSTs). Reads are idempotent by definition.
- `ADDITIVE_TOOL` — purely additive creations (`create_repo`, `create_issue`, adding a label or reaction). Destructive false, idempotent false.
- `DESTRUCTIVE_TOOL` — every non-additive change: edits, replacements, merges, removals and commands with potentially non-additive effects (`merge_pull_request`, `dispatch_workflow`, `sync_fork`, `admin_run_cron_job`). Follows the spec strictly: destructive false is reserved for additive-only operations.
- `openWorldHint` is true for every Forgejo API tool; only the lazy loader (`load_tool_area`, in `server.ts`) is false, because it changes local MCP session state only.

`idempotentHint` stays false for state-changing tools unless a repeated identical call is verified against Forgejo source to cause no further effect; do not infer it from the HTTP verb. The one verified exception is `get_runner_registration_token` (`{ ...DESTRUCTIVE_TOOL, idempotentHint: true }`). Annotations are hints, not authorisation controls.

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

## CI/CD

Forgejo Actions workflows live in `.forgejo/workflows/` and run on the `sqcows` host runner (Node is installed by a shell step, not `setup-node`). `ci.yml` runs lint, tests, and build on pushes to `main` and on pull requests. `release.yml` publishes to npm when a version tag (`0.2.0` or `v0.2.0`) matching `package.json` is pushed; it needs an `NPM_TOKEN` repository secret.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FORGEJO_URL` | Yes | Base URL of Forgejo/Gitea instance |
| `FORGEJO_TOKEN` | Yes | API token |
| `FORGEJO_DISABLED_AREAS` | No | Comma-separated tool areas to disable (e.g. `admin,actions`); all are enabled by default |
| `FORGEJO_LAZY_TOOLS` | No | `true` to start with only `load_tool_area` and load tool areas on demand, like `--lazy` (default: off). Needs a client that reloads its tool list mid-session |
| `FORGEJO_TIMEOUT_MS` | No | Forgejo request timeout in ms (default: 120000; 0 disables) |
| `FORGEJO_MAX_RESPONSE_BYTES` | No | Largest Forgejo response read (default: 10 MB) |
| `FORGEJO_MCP_API_KEY` | No | Bearer token for HTTP endpoint auth (required by `docker-compose.yml`, which fails to start without it) |
| `PORT` | No | HTTP port (default: 3000) |
| `RATE_LIMIT_MAX` | No | Requests per window (default: 100) |
| `RATE_LIMIT_WINDOW_MS` | No | Window in ms (default: 60000) |

## Conventions

- Tool names use snake_case with domain prefixes: `list_issues`, `create_issue`, `admin_create_user`
- Path params are destructured from query params: `const { owner, repo, ...query } = params`
- Single-segment identifiers (owner, repo, names) are validated against `PATH_SEGMENT_REGEX`, which also rejects `.` and `..`, to prevent path traversal
- Values that may contain slashes or special characters (branch, tag, ref, file path) must go through `encodePath()` when placed in a request path; single segments that need encoding use `encodeURIComponent()`
- File paths block `..`, leading `/`, and backslashes
- Pagination is bounded: page ≥ 1, limit 1–50
- The `ForgejoApiError` class never includes the full URL in messages to avoid leaking tokens
