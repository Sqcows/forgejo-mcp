# Changelog

All notable changes to this project will be documented in this file.

## [0.2.1] - 2026-10-12

### Changed
- The tool list sent to clients is now compacted, cutting it by about 40% (roughly 77k to 45k tokens with every area enabled). Validation-only JSON Schema keywords (`pattern`, `minLength`, `maxLength`, `additionalProperties`, `$schema`), the per-tool `execution` block, and the boilerplate descriptions of self-explanatory parameters (`owner`, `repo`, `org`, `page`, `limit`) are no longer sent. Inputs are still validated server-side exactly as before
- Parameters that reuse another parameter's schema now state their own type instead of pointing at it with a JSON Schema `$ref`, which not every client resolves
- Server instructions now summarize each tool area in one line instead of listing every tool name (about 9,900 to 1,900 characters); the names were already available from the tool list
- Tool results are returned as compact JSON rather than indented JSON, which costs the client less context on every call
- The compacted tool list is computed once per process instead of on every `tools/list` request
- Requests to Forgejo now time out after 120 seconds instead of waiting forever on a stalled connection. Set `FORGEJO_TIMEOUT_MS` to change this (`0` disables it)
- Responses from Forgejo are read up to 10 MB (`FORGEJO_MAX_RESPONSE_BYTES`). Larger logs, diffs, and raw files are returned truncated with a notice; a larger JSON response is refused with an error
- Dependencies updated: `@modelcontextprotocol/sdk` 1.26 to 1.32 (now the minimum) and `vitest` 3 to 4

### Fixed
- HTTP mode served only one client: a second `initialize` (another client, or the same one reconnecting) was rejected with "Server already initialized" until the server was restarted. Each client now gets its own session; the 32 most recently used are kept
- Branch names, tags, refs, and file paths containing `#`, `?`, or `%` addressed the wrong resource (`delete_branch` on `fix#12` acted on `fix`). They are now percent-encoded
- `/health` reported version `0.1.0` instead of the running version
- `--disable=admin,actions` was silently ignored, leaving those areas enabled; it now works like `--disable admin,actions`
- The HTTP server now exits promptly on SIGTERM/SIGINT, so `docker stop` no longer waits for the kill timeout

### Security
- A request whose target is not a valid URL (for example `GET //`) crashed the HTTP server before authentication. It now gets a 400
- `.` and `..` are no longer accepted as an owner, repository, or other name, and the API client refuses any path containing a dot segment (including `%2e` spellings). Previously these were resolved by URL parsing, so a tool call could reach an endpoint outside its own, including one in a disabled tool area
- When no API key is set, the HTTP endpoint rejects requests carrying a non-local `Origin` header, which blocks DNS rebinding from a web page against an unauthenticated local server
- The HTTP API key is compared in constant time
- CI verifies the SHA-256 of the Node.js download, and the release workflow no longer expands the tag name into a shell script
- Updated dependencies with known vulnerabilities (10 advisories in production dependencies, 24 including development tooling); `npm audit` now reports none
- HTTP mode refuses request bodies over 16 MB instead of buffering a body of any size
- A token containing whitespace or control characters is rejected at startup. Previously the resulting request error quoted the token into tool output
- `FORGEJO_URL` may no longer contain credentials, a query string, or a fragment, and the metadata-address block now covers the whole link-local range and IPv6 forms (`[::ffff:169.254.169.254]`, `[fd00:ec2::254]`)
- A non-numeric `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, or `PORT` now falls back to the default with a warning; a bad rate limit value used to lock every client out after their first request
- `docker-compose.yml` now refuses to start unless `FORGEJO_MCP_API_KEY` is set. It publishes port 3000 on every interface, and an unset key used to become an empty one, leaving the endpoint unauthenticated. **If you run the provided compose file without a key, add one to `.env` before upgrading**
- Added a test that drives every tool with hostile path values (`..`, encoded dots, `?`, `#`, backslashes) and checks the request stays on the tool's own endpoint

## [0.2.0] - 2026-10-12

Brings the server up to date with the Forgejo 16 API: 354 new tools (103 → 457), covering every non-deprecated endpoint except those listed under "Not covered".

### Added
- **Forgejo Actions** (54 tools, new `tools/actions.ts`): workflow runs (list, get, cancel, delete), run jobs and job logs, artifacts, tasks, `dispatch_workflow`, secrets and variables at repository, organization, and user scope, and runners (list, get, register, delete) at repository, organization, user, and instance scope
- **Repository settings** (50 tools, new `tools/repo-settings.ts`): webhooks, branch protections, tag protections, deploy keys, push mirrors and mirror sync, repository teams, wiki pages, `migrate_repo`, `generate_repo_from_template`, fork sync, transfer accept/reject, and repository flags
- **Packages** (6 tools, new `tools/packages.ts`): list, get, delete, list files, link and unlink
- **Repository** (+54): release get/edit/delete and release assets, tag create/get/delete, single commits, commit diffs, `compare_commits`, commit statuses, `change_files` (multi-file commits), raw file contents, git trees/blobs/refs/notes, `rename_branch`, `apply_diff_patch`, languages, stargazers, watchers, assignees, reviewers, activity feeds, collaborator check/remove/permission, topic add/delete/search, issue templates and config
- **Issues** (+46): cross-repository `search_issues`, `delete_issue`, reactions, dependencies and blocks, label replace/clear, pinning, deadlines, timeline, tracked times and stopwatches, subscriptions, and attachment management
- **Pull requests** (+16): `get_pr_patch`, `is_pr_merged`, `cancel_pr_auto_merge`, review get/submit/delete/dismiss, review comments, `get_pr_by_base_head`, pinned pull requests, `get_commit_pull_request`
- **Organizations** (+36): hook and label management, member and public-member management, user blocking, quota, `rename_org`, team search/edit/delete, team members and repositories, activity feeds
- **Users** (+50): follow/unfollow, emails, SSH and GPG keys, user webhooks, blocking, quota, settings, watched repositories, teams, tracked times, activity feeds, heatmap, and per-thread and per-repository notifications
- **Admin** (+42): email listing and search, system webhook management, quota groups and rules, unadopted repositories, creating organizations and repositories on behalf of users, user rename, user SSH keys and access tokens, instance settings, and instance signing keys
- New optional parameters on existing tools: `merge_pull_request` (`merge_when_checks_succeed`, `delete_branch_after_merge`, `force_merge`, `head_commit_id`, `merge_commit_id`, plus the `fast-forward-only` and `manually-merged` methods), `create_pr_review` (`commit_id`, `PENDING` event, `old_position`), `request_pr_review` (`team_reviewers`), `update_pr_branch` (`style`), `list_pull_requests` (`poster`, `base`, `head`), `list_issues` (`q`, `since`, `before`, `created_by`, `assigned_by`, `mentioned_by`), and `list_action_runners_jobs` (`labels`)
- Tool areas can be disabled individually with `--disable-<area>` flags, `--disable <a,b>`, or the `FORGEJO_DISABLED_AREAS` environment variable (areas: `repository`, `repo-settings`, `issues`, `pull-requests`, `organizations`, `users`, `actions`, `packages`, `admin`). Every area is loaded by default, and disabled areas are left out of the server instructions
- Forgejo Actions workflows: `ci.yml` (lint, test, build on pushes and pull requests) and `release.yml` (publish to npm when a version tag is pushed)

### Fixed
- `list_my_notifications` now sends the status filter as `status-types`, the name the API expects; it was previously sent as `status_types` and ignored
- `list_action_runners_jobs` now uses `/admin/actions/runners/jobs`, falling back to the deprecated `/admin/runners/jobs` on older instances

### Not covered
- ActivityPub federation endpoints, deprecated operations, multipart uploads (issue, comment, and release attachments), binary downloads (archives, artifact and log ZIPs, LFS media), avatars, server-side git hooks, OAuth2 applications, basic-auth-only token endpoints, and `POST /markdown/raw`

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
