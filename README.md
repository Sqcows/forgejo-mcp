# forgejo-mcp

A Model Context Protocol (MCP) server for [Forgejo](https://forgejo.org/) and [Gitea](https://gitea.com/) instances. Enables AI assistants like Claude, Cursor, and other MCP-compatible tools to interact with your Forgejo/Gitea repositories, issues, pull requests, and more.

## Features
- Comprehensive API coverage (102 tools across 6 categories)
- Configurable base URL - works with any Forgejo or Gitea instance
- Both stdio and HTTP transport modes
- Token-based authentication with optional HTTP Bearer auth
- Input validation and security hardening (path traversal protection, SSRF prevention, rate limiting)
- Docker support with security-hardened container

## Quick Start

### Prerequisites
- Node.js 18+
- A Forgejo or Gitea instance
- API token (generate at `{your-instance}/user/settings/applications`)

### Installation

```bash
npm install -g @ric_/forgejo-mcp
```

Or run directly:
```bash
npx @ric_/forgejo-mcp
```

### Configuration

Set environment variables:
```bash
export FORGEJO_URL=https://your-forgejo-instance.com
export FORGEJO_TOKEN=your-api-token
```

Or pass as CLI args:
```bash
npx @ric_/forgejo-mcp --url https://your-instance.com --token your-token
```

## Usage

### With Claude Code
You can add the MCP server using the CLI:
```bash
claude mcp add-json forgejo '{"command":"npx","args":["@ric_/forgejo-mcp"],"env":{"FORGEJO_URL":"https://your-instance.com","FORGEJO_TOKEN":"your-token"}}'
```

Or manually edit the config file:
- **Project scope** (shared with team): `.mcp.json` in your project root
- **User scope** (personal, all projects): `~/.claude.json`

Add the following to the `mcpServers` object:
```json
{
  "mcpServers": {
    "forgejo": {
      "command": "npx",
      "args": ["@ric_/forgejo-mcp"],
      "env": {
        "FORGEJO_URL": "https://your-instance.com",
        "FORGEJO_TOKEN": "your-token"
      }
    }
  }
}
```

You can verify the server is connected by running `/mcp` inside Claude Code.

### With Claude Desktop
Add to claude_desktop_config.json:
```json
{
  "mcpServers": {
    "forgejo": {
      "command": "npx",
      "args": ["@ric_/forgejo-mcp"],
      "env": {
        "FORGEJO_URL": "https://your-instance.com",
        "FORGEJO_TOKEN": "your-token"
      }
    }
  }
}
```

### HTTP Mode
For remote/shared access:
```bash
FORGEJO_URL=https://your-instance.com \
FORGEJO_TOKEN=your-token \
FORGEJO_MCP_API_KEY=your-secret-api-key \
npx @ric_/forgejo-mcp-http --port 3000
```
Endpoint: `http://localhost:3000/mcp`

**Authentication:** Set `FORGEJO_MCP_API_KEY` to require Bearer token authentication on the HTTP endpoint. Clients must include `Authorization: Bearer your-secret-api-key` in requests. If not set, the endpoint is unauthenticated (only suitable for localhost or behind a reverse proxy).

**Rate Limiting:** Enabled by default at 100 requests/minute per IP. Configure via:
- `RATE_LIMIT_MAX` - max requests per window (default: 100)
- `RATE_LIMIT_WINDOW_MS` - window size in milliseconds (default: 60000)

### Docker
Pull from Docker Hub:
```bash
docker run -p 3000:3000 \
  -e FORGEJO_URL=https://your-instance.com \
  -e FORGEJO_TOKEN=your-token \
  -e FORGEJO_MCP_API_KEY=your-secret-key \
  richarvey/forgejo-mcp
```

Or use docker-compose:
```bash
cp .env.example .env
# Edit .env with your values, then:
docker compose up -d
```

Or build from source:
```bash
docker build -t forgejo-mcp .
docker run -p 3000:3000 \
  -e FORGEJO_URL=https://your-instance.com \
  -e FORGEJO_TOKEN=your-token \
  -e FORGEJO_MCP_API_KEY=your-secret-key \
  forgejo-mcp
```

The Docker image:
- Uses multi-stage build for minimal image size
- Runs as non-root user
- Read-only filesystem
- No new privileges security option

## Available Tools

### Repository Management (24 tools)
| Tool | Description |
|------|-------------|
| `search_repos` | Search repositories |
| `get_repo` | Get repository details |
| `create_repo` | Create a new repository |
| `create_org_repo` | Create repo in an organization |
| `delete_repo` | Delete a repository |
| `fork_repo` | Fork a repository |
| `list_branches` | List branches |
| `get_branch` | Get branch details |
| `create_branch` | Create a branch |
| `delete_branch` | Delete a branch |
| `list_repo_commits` | List commits |
| `get_file_contents` | Get file contents |
| `create_file` | Create a file |
| `update_file` | Update a file |
| `delete_file` | Delete a file |
| `list_releases` | List releases |
| `create_release` | Create a release |
| `list_tags` | List tags |
| `list_repo_topics` | List topics |
| `update_repo_topics` | Update topics |
| `list_forks` | List forks |
| `list_collaborators` | List collaborators |
| `add_collaborator` | Add a collaborator |
| `transfer_repo` | Transfer repository |

### Issue Management (20 tools)
| Tool | Description |
|------|-------------|
| `list_issues` | List repository issues |
| `get_issue` | Get issue details |
| `create_issue` | Create an issue |
| `edit_issue` | Edit an issue |
| `list_issue_comments` | List issue comments |
| `create_issue_comment` | Add a comment |
| `edit_issue_comment` | Edit a comment |
| `delete_issue_comment` | Delete a comment |
| `list_labels` | List repository labels |
| `get_label` | Get label details |
| `create_label` | Create a label |
| `edit_label` | Edit a label |
| `delete_label` | Delete a label |
| `add_issue_labels` | Add labels to issue |
| `remove_issue_label` | Remove label from issue |
| `list_milestones` | List milestones |
| `get_milestone` | Get milestone details |
| `create_milestone` | Create a milestone |
| `edit_milestone` | Edit a milestone |
| `delete_milestone` | Delete a milestone |

### Pull Request Management (12 tools)
| Tool | Description |
|------|-------------|
| `list_pull_requests` | List pull requests |
| `get_pull_request` | Get PR details |
| `create_pull_request` | Create a pull request |
| `edit_pull_request` | Edit a pull request |
| `merge_pull_request` | Merge a pull request |
| `list_pr_commits` | List PR commits |
| `list_pr_files` | List changed files |
| `get_pr_diff` | Get PR diff |
| `list_pr_reviews` | List PR reviews |
| `create_pr_review` | Create a review |
| `request_pr_review` | Request reviewers |
| `update_pr_branch` | Update PR branch |

### Organization Management (14 tools)
| Tool | Description |
|------|-------------|
| `list_orgs` | List organizations |
| `get_org` | Get org details |
| `create_org` | Create organization |
| `edit_org` | Edit organization |
| `delete_org` | Delete organization |
| `list_org_repos` | List org repositories |
| `list_org_members` | List org members |
| `list_org_teams` | List org teams |
| `get_team` | Get team details |
| `create_team` | Create a team |
| `add_team_member` | Add team member |
| `remove_team_member` | Remove team member |
| `list_org_labels` | List org labels |
| `list_org_hooks` | List org webhooks |

### User Management (13 tools)
| Tool | Description |
|------|-------------|
| `get_authenticated_user` | Get current user |
| `get_user` | Get user profile |
| `list_user_repos` | List user repositories |
| `list_user_orgs` | List user organizations |
| `search_users` | Search users |
| `list_followers` | List followers |
| `list_following` | List following |
| `list_user_starred` | List starred repos |
| `list_my_starred` | List my starred repos |
| `star_repo` | Star a repository |
| `unstar_repo` | Unstar a repository |
| `list_my_notifications` | List notifications |
| `mark_notifications_read` | Mark all as read |

### Admin & System (19 tools)
| Tool | Description |
|------|-------------|
| `admin_list_users` | List all users (admin) |
| `admin_create_user` | Create user (admin) |
| `admin_delete_user` | Delete user (admin) |
| `admin_edit_user` | Edit user (admin) |
| `admin_list_cron_jobs` | List cron jobs |
| `admin_run_cron_job` | Run cron task |
| `admin_list_hooks` | List system webhooks |
| `get_server_version` | Get server version |
| `render_markdown` | Render markdown |
| `render_markup` | Render markup |
| `list_gitignore_templates` | List gitignore templates |
| `get_gitignore_template` | Get gitignore template |
| `list_license_templates` | List license templates |
| `get_license_template` | Get license template |
| `list_label_templates` | List label templates |
| `get_label_template` | Get label template |
| `get_nodeinfo` | Get instance info |
| `list_action_runners_jobs` | List action jobs |
| `get_runner_registration_token` | Get runner token |

## Security

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FORGEJO_URL` | Yes | Base URL of your Forgejo/Gitea instance |
| `FORGEJO_TOKEN` | Yes | API token (generate at `{your-instance}/user/settings/applications`) |
| `FORGEJO_MCP_API_KEY` | No | Bearer token for HTTP endpoint authentication |
| `RATE_LIMIT_MAX` | No | Max requests per rate limit window (default: 100) |
| `RATE_LIMIT_WINDOW_MS` | No | Rate limit window in ms (default: 60000) |
| `PORT` | No | HTTP server port (default: 3000) |

### Security Features
- **Input validation** - All parameters validated with Zod schemas (path traversal prevention, regex-validated usernames, bounded pagination, enum enforcement)
- **SSRF protection** - Base URL validated against cloud metadata endpoints and private IP ranges
- **HTTP authentication** - Optional Bearer token auth for the HTTP transport
- **Rate limiting** - Per-IP rate limiting on HTTP endpoints
- **Token safety** - API tokens never leaked in error messages; URLs sanitized in errors
- **Security headers** - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
- **Non-root Docker** - Container runs as unprivileged user with read-only filesystem

### Best Practices
- Always use HTTPS for your Forgejo instance URL
- Use short-lived API tokens with minimal required permissions
- Set `FORGEJO_MCP_API_KEY` when running HTTP mode on a network
- Admin tools require an admin-level Forgejo token - use a non-admin token if you don't need them

## Development

```bash
git clone https://code.squarecows.com/SquareCows/forgejo-mcp.git
cd forgejo-mcp
npm install
npm run dev          # stdio mode
npm run dev:http     # HTTP mode
npm test             # run tests
npm run build        # compile TypeScript
```

## Compatible Instances

This MCP server works with:
- [Forgejo](https://forgejo.org/) (v7.0+)
- [Gitea](https://gitea.com/) (v1.20+)
- [Codeberg](https://codeberg.org/)
- Any Gitea-compatible forge

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](https://code.squarecows.com/SquareCows/forgejo-mcp/src/branch/main/CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](https://code.squarecows.com/SquareCows/forgejo-mcp/src/branch/main/LICENSE)
