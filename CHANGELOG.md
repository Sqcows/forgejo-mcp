# Changelog

All notable changes to this project will be documented in this file.

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
