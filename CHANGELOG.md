# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-08-28

### Fixed
- HTTP rate limiter is a token bucket (default burst 50, 1000/min) instead of a fixed window, so a 429's `Retry-After` is ~1s of refill rather than the rest of the minute.
- MCP `initialize` (POST `/mcp` with no `Mcp-Session-Id`) uses a separate handshake bucket (24 per 10s). Grok Web opens a Streamable HTTP session per tool call; parallel `call_connected_tool` handshakes no longer share the RPC budget or lock the IP for 60s. Health, CORS preflight, and OAuth discovery are still exempt. Set `RATE_LIMIT_MAX=0` to disable.

### Changed
- `create_file` and `update_file` now accept the file body as plain text and base64-encode it before calling the Forgejo Contents API, matching GitHub MCP. Do not pass base64 from the client.
- `get_file_contents` decodes text files to UTF-8 (`encoding: "utf-8"`). Binary files still return base64 (`encoding: "base64"`).
- Create/update file responses omit the echoed file body and other Contents API noise; they return path, blob SHA, size, and commit metadata.

## [0.1.9] - 2026-08-27

### Fixed
- HTTP transport no longer returns JSON-RPC `-32600 Server already initialized` on Grok Web's second `initialize`. Each MCP session gets its own Streamable HTTP transport; a later initialize starts a new session instead of reusing the process-wide one.

## [0.1.8] - 2026-08-27

### Added
- OAuth 2.1 authorization code + PKCE on the HTTP transport so Grok Web custom connectors can authenticate. Discovery (`/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`), dynamic client registration, a password-gated consent page, and refresh-token rotation are included. The static `Authorization: Bearer $FORGEJO_MCP_API_KEY` path still works for CLI clients.
- `OAUTH_PUBLIC_URL` to advertise the public HTTPS issuer when running behind a tunnel or reverse proxy.
- README values for Grok Web's OAuth form (client ID `forgejo-mcp`, blank secret, `/oauth/authorize`, `/oauth/token`, scope `mcp`, token auth method none/PKCE).

## [0.1.7] - 2026-06-18

### Fixed
- Responses with empty bodies (e.g. `merge_pull_request`, `update_pr_branch`) no longer throw `Unexpected end of JSON input`. The operation was succeeding server-side but the tool reported an error. `request()` now reads the body as text and returns `undefined` for empty responses
- `render_markdown` and `render_markup` no longer throw `Unexpected token '<'`. These endpoints return raw HTML rather than JSON, which is now returned as-is (with a JSON fallback when the content-type header is missing)
- `create_team` no longer returns `500` when `units` is omitted for read/write teams; it now defaults to the standard repository unit set

### Changed
- Server version reported during the MCP `initialize` handshake is now read from `package.json` at runtime instead of being hardcoded, so it can no longer drift from the published version

### Internal
- Added a working ESLint flat config (`eslint.config.js`) with `typescript-eslint`; `npm run lint` was previously non-functional (no config and no TypeScript parser)
- Removed dead imports surfaced by the linter
- Added regression tests for empty-body, HTML, and `create_team` units handling

## [0.1.6] - 2026-06-14

### Fixed
- `update_file` now uses PUT instead of PATCH on `/repos/{owner}/{repo}/contents/{filepath}`, matching the Forgejo API spec. PATCH was returning `405 Method Not Allowed`

## [0.1.5] - 2026-03-21

### Added
- Server instructions sent to clients during MCP `initialize` handshake, providing tool categories and usage conventions so AI assistants understand how to use the server automatically

## [0.1.4] - 2026-03-21

### Added
- `edit_repo` tool for editing repository settings via PATCH API

## [0.1.3]

### Fixed
- `formatResponse` now handles 204 No Content responses correctly

## [0.1.2]

### Fixed
- HTTP methods for `update_repo_topics` and `add_collaborator` tools (were using wrong verbs)

## [0.1.1]

### Changed
- Package renamed to `@ric_/forgejo-mcp`
- Added Docker Hub references

## [0.1.0]

### Added
- Initial release with 103 tools across 6 categories (Repository, Issues, Pull Requests, Organizations, Users, Admin)
- Stdio and HTTP transport modes
- Token-based authentication with optional HTTP Bearer auth
- Input validation with Zod schemas
- SSRF protection, path traversal prevention, rate limiting
- Docker support with security-hardened container
