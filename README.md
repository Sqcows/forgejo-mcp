# forgejo-mcp

A Model Context Protocol (MCP) server for [Forgejo](https://forgejo.org/) and [Gitea](https://gitea.com/) instances. Enables AI assistants like Claude, Cursor, and other MCP-compatible tools to interact with your Forgejo/Gitea repositories, issues, pull requests, and more.

## Features
- Comprehensive API coverage (457 tools across 9 categories)
- Tool areas can be disabled individually (see [Disabling tool areas](#disabling-tool-areas))
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

### Disabling tool areas

All 457 tools are loaded by default. If your MCP client struggles with that many tools, or you want to hide capabilities such as the admin API, you can switch off whole areas. Disabled areas are not registered at all, and are left out of the instructions sent to the client.

| Area | Flag | Tools | What it covers |
|------|------|-------|----------------|
| `repository` | `--disable-repository` | 79 | Repos, branches, files, commits, releases, tags |
| `repo-settings` | `--disable-repo-settings` | 50 | Webhooks, branch and tag protections, deploy keys, mirrors, wiki, migration |
| `issues` | `--disable-issues` | 66 | Issues, comments, labels, milestones, time tracking |
| `pull-requests` | `--disable-pull-requests` | 28 | Pull requests and reviews |
| `organizations` | `--disable-organizations` | 50 | Organizations and teams |
| `users` | `--disable-users` | 63 | Users, keys, notifications, personal settings |
| `actions` | `--disable-actions` | 54 | Forgejo Actions runs, secrets, variables, runners (including instance-level runner management) |
| `packages` | `--disable-packages` | 6 | Package registry |
| `admin` | `--disable-admin` | 61 | Instance administration, plus system utilities (version, markdown rendering, gitignore/license/label templates) |

There are three ways to disable areas, and they can be combined:

```bash
# One flag per area
npx @ric_/forgejo-mcp --disable-admin --disable-actions

# A comma-separated list
npx @ric_/forgejo-mcp --disable admin,actions

# An environment variable
export FORGEJO_DISABLED_AREAS=admin,actions
```

In an MCP client config, add the flags to `args` or set the variable in `env`:

```json
{
  "mcpServers": {
    "forgejo": {
      "command": "npx",
      "args": ["@ric_/forgejo-mcp", "--disable-admin", "--disable-actions"],
      "env": {
        "FORGEJO_URL": "https://your-instance.com",
        "FORGEJO_TOKEN": "your-token"
      }
    }
  }
}
```

The same flags work in HTTP mode (`npx @ric_/forgejo-mcp-http --disable-admin`). With Docker or docker-compose, use the environment variable:

```bash
docker run -p 3000:3000 \
  -e FORGEJO_URL=https://your-instance.com \
  -e FORGEJO_TOKEN=your-token \
  -e FORGEJO_DISABLED_AREAS=admin,actions \
  richarvey/forgejo-mcp
```

Area names are case-insensitive. An unknown name stops the server at startup with a list of the valid areas, so a typo cannot silently leave an area enabled.

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

**Sessions:** Each client gets its own session. The 32 most recently used sessions are kept; a client whose session has been closed receives a 404 and starts a new one.

**Browser requests:** When `FORGEJO_MCP_API_KEY` is not set, requests carrying an `Origin` header are rejected unless the origin is local (`localhost`, `127.0.0.1`, `[::1]`). MCP clients do not send one; this stops a web page from reaching an unauthenticated local server through DNS rebinding.

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
# Edit .env: set FORGEJO_URL, FORGEJO_TOKEN and FORGEJO_MCP_API_KEY, then:
docker compose up -d
```

`docker-compose.yml` publishes port 3000 on every network interface, so it requires `FORGEJO_MCP_API_KEY` and refuses to start when the key is unset or empty:

```
error while interpolating services.forgejo-mcp.environment.[]: required variable FORGEJO_MCP_API_KEY is missing a value: FORGEJO_MCP_API_KEY must be set (for example in .env). Generate one with 'openssl rand -hex 32'
```

Generate a key with `openssl rand -hex 32`, put it in `.env`, and have clients send it as `Authorization: Bearer <key>`.

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

## Auto Setup

When an MCP client (such as Claude Code, Claude Desktop, or Cursor) connects to this server, it automatically receives short instructions summarizing the enabled tool areas and the usage conventions: that most tools require `owner` and `repo` parameters, how pagination works, and that file content should be base64-encoded.

No configuration is needed to enable this; it works out of the box via the MCP `initialize` handshake.

### Context usage

Tool definitions take up space in the client's context window, so the server keeps them lean:

- The tool list omits JSON Schema detail the model does not need to call a tool (`pattern`, `minLength`, `maxLength`, `additionalProperties`, `$schema`) and the boilerplate descriptions of self-explanatory parameters such as `owner`, `repo`, `page`, and `limit`. Inputs are still fully validated by the server, which returns a clear error for a bad value.
- The instructions summarize each area in one line rather than listing every tool.
- Tool results are returned as compact JSON, without indentation.

With every area enabled the tool list is roughly 45k tokens. To reduce it further, [disable the areas you do not use](#disabling-tool-areas).

## Available Tools

### Repository Management (79 tools)
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
| `edit_repo` | Edit a repository's settings |
| `transfer_repo` | Transfer repository |
| `get_release` | Get a release by ID |
| `get_latest_release` | Get the most recent non-prerelease, non-draft release of a repository |
| `get_release_by_tag` | Get a release by tag name |
| `edit_release` | Update a release |
| `delete_release` | Delete a release by ID |
| `delete_release_by_tag` | Delete a release by tag name |
| `list_release_assets` | List the attachments of a release |
| `get_release_asset` | Get a release attachment |
| `edit_release_asset` | Edit a release attachment |
| `delete_release_asset` | Delete a release attachment |
| `create_tag` | Create a new git tag in a repository |
| `get_tag` | Get a tag of a repository by tag name |
| `delete_tag` | Delete a repository's tag by name |
| `get_commit` | Get a single commit from a repository |
| `get_commit_diff` | Get the diff or patch of a commit |
| `compare_commits` | Compare two branches, tags, or commits |
| `get_combined_commit_status` | Get the combined status of a commit by branch, tag, or commit SHA |
| `list_commit_statuses_by_ref` | List the statuses of a commit by branch, tag, or commit SHA |
| `list_commit_statuses` | List the statuses of a commit by SHA |
| `create_commit_status` | Create a commit status (e.g |
| `list_repo_contents` | List the metadata of all entries in the root directory of a repository |
| `change_files` | Create, update, and delete multiple files in a repository in a single commit |
| `get_raw_file` | Get the raw contents of a file in a repository |
| `get_editorconfig` | Get the EditorConfig definitions that apply to a file in a repository |
| `apply_diff_patch` | Apply a diff patch to a repository as a new commit |
| `get_git_tree` | Get the git tree of a repository |
| `get_git_blob` | Get a git blob (base64 encoded) of a repository |
| `get_git_blobs` | Get multiple git blobs of a repository |
| `list_git_refs` | List all git refs of a repository |
| `get_git_ref` | Get git refs matching a full or partial ref name (e.g |
| `get_annotated_tag` | Get the tag object of an annotated tag |
| `get_commit_note` | Get the git note attached to a commit |
| `set_commit_note` | Set the git note attached to a commit |
| `delete_commit_note` | Remove the git note attached to a commit |
| `rename_branch` | Rename a branch |
| `list_repo_languages` | Get the languages of a repository and the number of bytes of code in each |
| `list_stargazers` | List the users who starred a repository |
| `list_repo_watchers` | List the users watching a repository |
| `get_repo_subscription` | Check if the authenticated user is watching a repository |
| `watch_repo` | Watch a repository as the authenticated user |
| `unwatch_repo` | Stop watching a repository as the authenticated user |
| `list_repo_assignees` | List the users who can be assigned to issues in a repository |
| `list_repo_reviewers` | List the users who can be requested to review pull requests in a repository |
| `list_repo_activity_feeds` | List a repository's activity feeds |
| `check_collaborator` | Check if a user is a collaborator of a repository |
| `remove_collaborator` | Remove a collaborator from a repository |
| `get_collaborator_permission` | Get the repository permissions of a user |
| `add_repo_topic` | Add a topic to a repository |
| `delete_repo_topic` | Remove a topic from a repository |
| `search_topics` | Search for topics by keyword |
| `get_repo_by_id` | Get a repository by its numeric ID |
| `list_issue_templates` | List the available issue templates of a repository |
| `get_issue_config` | Get the issue config of a repository |
| `validate_issue_config` | Get the validation information for the issue config of a repository |

### Repository Settings (webhooks, protections, keys, mirrors, wiki) (50 tools)
| Tool | Description |
|------|-------------|
| `list_repo_hooks` | List the webhooks in a repository |
| `get_repo_hook` | Get a repository webhook by ID |
| `create_repo_hook` | Create a webhook in a repository |
| `edit_repo_hook` | Edit a webhook in a repository |
| `delete_repo_hook` | Delete a webhook from a repository |
| `test_repo_hook` | Send a test push event to a repository webhook |
| `list_branch_protections` | List branch protection rules for a repository |
| `get_branch_protection` | Get a branch protection rule by name |
| `create_branch_protection` | Create a branch protection rule for a repository |
| `edit_branch_protection` | Edit a branch protection rule |
| `delete_branch_protection` | Delete a branch protection rule |
| `list_tag_protections` | List tag protection rules for a repository |
| `get_tag_protection` | Get a tag protection rule by ID |
| `create_tag_protection` | Create a tag protection rule for a repository |
| `edit_tag_protection` | Edit a tag protection rule |
| `delete_tag_protection` | Delete a tag protection rule |
| `list_deploy_keys` | List a repository's deploy keys |
| `get_deploy_key` | Get a repository deploy key by ID |
| `add_deploy_key` | Add a deploy key to a repository |
| `delete_deploy_key` | Delete a deploy key from a repository |
| `list_push_mirrors` | List the push mirrors of a repository |
| `get_push_mirror` | Get a push mirror of a repository by its remote name |
| `add_push_mirror` | Set up a new push mirror in a repository |
| `delete_push_mirror` | Remove a push mirror from a repository by its remote name |
| `sync_push_mirrors` | Trigger a sync of all push mirrors of a repository |
| `sync_mirror` | Trigger a sync of a pull-mirrored repository |
| `convert_mirror_repo` | Convert a mirror repository to a normal repository |
| `list_repo_teams` | List the teams assigned to a repository |
| `check_repo_team` | Check if a team is assigned to a repository |
| `add_repo_team` | Assign a team to a repository |
| `remove_repo_team` | Remove a team from a repository |
| `list_wiki_pages` | List all wiki pages of a repository |
| `get_wiki_page` | Get a wiki page (content is returned base64 encoded) |
| `create_wiki_page` | Create a wiki page |
| `edit_wiki_page` | Edit a wiki page |
| `delete_wiki_page` | Delete a wiki page |
| `list_wiki_page_revisions` | List the revisions of a wiki page |
| `migrate_repo` | Migrate (import) a remote git repository, optionally as a mirror |
| `generate_repo_from_template` | Create a new repository from a template repository |
| `get_sync_fork_info` | Get information about syncing a fork branch with its base repository (commits behind, whether a sync is possible) |
| `sync_fork` | Sync a fork branch with the base repository's branch |
| `accept_repo_transfer` | Accept a pending repository transfer |
| `reject_repo_transfer` | Reject a pending repository transfer |
| `list_repo_flags` | List a repository's flags (instance admin only) |
| `replace_repo_flags` | Replace all flags of a repository (instance admin only) |
| `clear_repo_flags` | Remove all flags from a repository (instance admin only) |
| `check_repo_flag` | Check if a repository has a given flag (instance admin only) |
| `add_repo_flag` | Add a flag to a repository (instance admin only) |
| `remove_repo_flag` | Remove a flag from a repository (instance admin only) |
| `get_repo_signing_key` | Get the GPG public key used to sign commits made by the instance in a repository |

### Issue Management (66 tools)
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
| `search_issues` | Search for issues and pull requests across all repositories the user has access to |
| `delete_issue` | Delete an issue |
| `list_repo_comments` | List all issue and pull request comments in a repository |
| `get_issue_comment` | Get a single issue comment by ID |
| `list_issue_reactions` | List reactions on an issue |
| `add_issue_reaction` | Add a reaction to an issue |
| `remove_issue_reaction` | Remove a reaction from an issue |
| `list_comment_reactions` | List reactions on an issue comment |
| `add_comment_reaction` | Add a reaction to an issue comment |
| `remove_comment_reaction` | Remove a reaction from an issue comment |
| `list_issue_dependencies` | List the issues that block this issue (its dependencies) |
| `add_issue_dependency` | Make an issue depend on another issue |
| `remove_issue_dependency` | Remove a dependency from an issue |
| `list_issue_blocks` | List the issues that are blocked by this issue |
| `add_issue_block` | Mark another issue as blocked by this issue |
| `remove_issue_block` | Unblock another issue that is blocked by this issue |
| `get_issue_labels` | Get the labels of an issue |
| `replace_issue_labels` | Replace all of an issue's labels |
| `clear_issue_labels` | Remove all labels from an issue |
| `pin_issue` | Pin an issue or pull request |
| `unpin_issue` | Unpin an issue or pull request |
| `move_issue_pin` | Move a pinned issue to a new position |
| `list_pinned_issues` | List a repository's pinned issues |
| `check_new_pin_allowed` | Check whether new issue and pull request pins are allowed in a repository |
| `set_issue_deadline` | Set or remove the deadline of an issue |
| `list_issue_timeline` | List all comments and events on an issue |
| `list_issue_tracked_times` | List an issue's tracked times |
| `add_issue_tracked_time` | Add tracked time to an issue |
| `reset_issue_tracked_times` | Reset all tracked time of an issue |
| `delete_issue_tracked_time` | Delete a specific tracked time entry from an issue |
| `list_repo_tracked_times` | List a repository's tracked times |
| `start_issue_stopwatch` | Start a stopwatch on an issue |
| `stop_issue_stopwatch` | Stop an issue's stopwatch and record the tracked time |
| `delete_issue_stopwatch` | Delete an issue's stopwatch without recording time |
| `list_issue_subscriptions` | List the users subscribed to an issue |
| `check_issue_subscription` | Check whether the authenticated user is subscribed to an issue |
| `subscribe_issue` | Subscribe a user to an issue |
| `unsubscribe_issue` | Unsubscribe a user from an issue |
| `list_issue_attachments` | List an issue's attachments |
| `get_issue_attachment` | Get an issue attachment |
| `edit_issue_attachment` | Edit an issue attachment |
| `delete_issue_attachment` | Delete an issue attachment |
| `list_comment_attachments` | List an issue comment's attachments |
| `get_comment_attachment` | Get an issue comment attachment |
| `edit_comment_attachment` | Edit an issue comment attachment |
| `delete_comment_attachment` | Delete an issue comment attachment |

### Pull Request Management (28 tools)
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
| `get_pr_patch` | Get the patch (git format-patch) of a pull request |
| `is_pr_merged` | Check if a pull request has been merged |
| `cancel_pr_auto_merge` | Cancel the scheduled auto merge of a pull request |
| `cancel_pr_review_request` | Cancel review requests for a pull request |
| `get_pr_review` | Get a specific review of a pull request |
| `submit_pr_review` | Submit a pending review on a pull request |
| `delete_pr_review` | Delete a specific review from a pull request |
| `list_pr_review_comments` | List the comments of a pull request review |
| `create_pr_review_comment` | Add a new inline comment to a pull request review |
| `get_pr_review_comment` | Get a single comment of a pull request review |
| `delete_pr_review_comment` | Delete a comment from a pull request review |
| `dismiss_pr_review` | Dismiss a review of a pull request |
| `undismiss_pr_review` | Cancel the dismissal of a pull request review |
| `get_pr_by_base_head` | Get a pull request by its base and head branches |
| `list_pinned_pull_requests` | List a repository's pinned pull requests |
| `get_commit_pull_request` | Get the pull request associated with a commit |

### Organization Management (50 tools)
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
| `create_org_hook` | Create a webhook for an organization |
| `get_org_hook` | Get a webhook of an organization |
| `edit_org_hook` | Update a webhook of an organization |
| `delete_org_hook` | Delete a webhook from an organization |
| `create_org_label` | Create a label for an organization |
| `get_org_label` | Get a single organization label |
| `edit_org_label` | Update an organization label |
| `delete_org_label` | Delete an organization label |
| `check_org_member` | Check if a user is a member of an organization (succeeds if they are, 404 error if not) |
| `remove_org_member` | Remove a member from an organization |
| `list_org_public_members` | List an organization's public members |
| `check_org_public_member` | Check if a user is a public member of an organization (succeeds if they are, 404 error if not) |
| `publicize_org_membership` | Make a user's membership of an organization public |
| `conceal_org_membership` | Conceal a user's membership of an organization |
| `list_org_blocked_users` | List the users blocked by an organization |
| `org_block_user` | Block a user from an organization |
| `org_unblock_user` | Unblock a user from an organization |
| `get_org_quota` | Get quota information for an organization |
| `list_org_quota_artifacts` | List the artifacts affecting an organization's quota |
| `list_org_quota_attachments` | List the attachments affecting an organization's quota |
| `list_org_quota_packages` | List the packages affecting an organization's quota |
| `check_org_quota` | Check if an organization is over quota for a given subject |
| `rename_org` | Rename an organization |
| `search_org_teams` | Search for teams within an organization |
| `list_org_activity_feeds` | List an organization's activity feeds |
| `list_team_activity_feeds` | List a team's activity feeds |
| `edit_team` | Edit a team |
| `delete_team` | Delete a team |
| `list_team_members` | List a team's members |
| `get_team_member` | Get a particular member of a team (404 error if the user is not a member) |
| `list_team_repos` | List a team's repositories |
| `get_team_repo` | Get a particular repository of a team (404 error if the team has no access) |
| `add_team_repo` | Add a repository to a team |
| `remove_team_repo` | Remove a repository from a team |
| `list_my_orgs` | List the authenticated user's organizations |
| `get_user_org_permissions` | Get a user's permissions in an organization |

### User Management (63 tools)
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
| `check_new_notifications` | Check if the authenticated user has unread notifications (returns the unread count) |
| `get_notification_thread` | Get a notification thread by ID |
| `mark_notification_thread_read` | Mark a notification thread as read (or another status) by ID |
| `list_repo_notifications` | List the authenticated user's notification threads on a specific repository |
| `mark_repo_notifications_read` | Mark notification threads on a specific repository as read, pinned or unread |
| `list_my_followers` | List the authenticated user's followers |
| `list_my_following` | List the users that the authenticated user is following |
| `check_my_following` | Check whether the authenticated user follows a user (succeeds if so, 404 error if not) |
| `follow_user` | Follow a user |
| `unfollow_user` | Unfollow a user |
| `check_user_following` | Check if one user follows another user (succeeds if so, 404 error if not) |
| `list_my_emails` | List all email addresses of the authenticated user |
| `add_my_emails` | Add email addresses to the authenticated user's account |
| `delete_my_emails` | Delete email addresses from the authenticated user's account |
| `list_my_ssh_keys` | List the authenticated user's SSH public keys |
| `create_my_ssh_key` | Add an SSH public key to the authenticated user's account |
| `get_my_ssh_key` | Get one of the authenticated user's SSH public keys |
| `delete_my_ssh_key` | Delete an SSH public key from the authenticated user's account |
| `list_user_ssh_keys` | List a user's SSH public keys |
| `list_my_gpg_keys` | List the authenticated user's GPG keys |
| `add_my_gpg_key` | Add a GPG public key to the authenticated user's account |
| `get_my_gpg_key` | Get one of the authenticated user's GPG keys |
| `delete_my_gpg_key` | Remove a GPG public key from the authenticated user's account |
| `get_gpg_key_verification_token` | Get a token to sign in order to verify a GPG key |
| `verify_my_gpg_key` | Verify one of the authenticated user's GPG keys with a signed verification token |
| `list_user_gpg_keys` | List a user's GPG keys |
| `list_my_hooks` | List the authenticated user's webhooks |
| `create_my_hook` | Create a webhook for the authenticated user |
| `get_my_hook` | Get one of the authenticated user's webhooks |
| `edit_my_hook` | Update one of the authenticated user's webhooks |
| `delete_my_hook` | Delete one of the authenticated user's webhooks |
| `list_my_blocked_users` | List the users blocked by the authenticated user |
| `block_user` | Block a user as the authenticated user |
| `unblock_user` | Unblock a user as the authenticated user |
| `get_my_quota` | Get quota information for the authenticated user |
| `list_my_quota_artifacts` | List the artifacts affecting the authenticated user's quota |
| `list_my_quota_attachments` | List the attachments affecting the authenticated user's quota |
| `list_my_quota_packages` | List the packages affecting the authenticated user's quota |
| `check_my_quota` | Check if the authenticated user is over quota for a given subject |
| `list_my_repos` | List the repositories that the authenticated user owns |
| `get_my_settings` | Get the authenticated user's account settings |
| `update_my_settings` | Update the authenticated user's account settings |
| `check_repo_starred` | Check whether the authenticated user has starred a repository (succeeds if so, 404 error if not) |
| `list_my_stopwatches` | List the authenticated user's running stopwatches |
| `list_my_subscriptions` | List the repositories watched by the authenticated user |
| `list_user_subscriptions` | List the repositories watched by a user |
| `list_my_teams` | List all the teams the authenticated user belongs to |
| `list_my_tracked_times` | List the authenticated user's tracked times |
| `list_user_activity_feeds` | List a user's activity feeds |
| `get_user_heatmap` | Get a user's contribution heatmap |

### Forgejo Actions (CI/CD) (54 tools)
| Tool | Description |
|------|-------------|
| `list_action_runs` | List a repository's Actions workflow runs |
| `get_action_run` | Get a single Actions workflow run |
| `delete_action_run` | Delete a completed Actions workflow run |
| `cancel_action_run` | Cancel a pending or running Actions workflow run |
| `list_action_run_jobs` | List the jobs of an Actions workflow run |
| `get_action_job_logs` | Get the plaintext logs of an Actions job |
| `list_action_run_artifacts` | List the artifacts of an Actions workflow run |
| `list_action_artifacts` | List a repository's Actions artifacts |
| `get_action_artifact` | Get the metadata of an Actions artifact |
| `delete_action_artifact` | Mark an Actions artifact for deletion |
| `list_action_tasks` | List a repository's Actions tasks |
| `dispatch_workflow` | Trigger an Actions workflow run (workflow_dispatch event) |
| `list_repo_action_secrets` | List the Actions secrets of a repository (names only, values are never returned) |
| `set_repo_action_secret` | Create or update an Actions secret for a repository |
| `delete_repo_action_secret` | Delete an Actions secret of a repository |
| `list_repo_action_variables` | List the Actions variables of a repository |
| `get_repo_action_variable` | Get an Actions variable of a repository |
| `create_repo_action_variable` | Create an Actions variable for a repository |
| `update_repo_action_variable` | Update the value (and optionally the name) of an Actions variable of a repository |
| `delete_repo_action_variable` | Delete an Actions variable of a repository |
| `list_repo_runners` | List the Actions runners of a repository |
| `get_repo_runner` | Get an Actions runner of a repository |
| `register_repo_runner` | Register a new Actions runner for a repository |
| `delete_repo_runner` | Delete an Actions runner of a repository |
| `list_repo_runner_jobs` | Search the Actions run jobs of a repository that are waiting for a runner, optionally filtered by labels |
| `list_org_action_secrets` | List the Actions secrets of an organization (names only, values are never returned) |
| `set_org_action_secret` | Create or update an Actions secret for an organization |
| `delete_org_action_secret` | Delete an Actions secret of an organization |
| `list_org_action_variables` | List the Actions variables of an organization |
| `get_org_action_variable` | Get an Actions variable of an organization |
| `create_org_action_variable` | Create an Actions variable for an organization |
| `update_org_action_variable` | Update the value (and optionally the name) of an Actions variable of an organization |
| `delete_org_action_variable` | Delete an Actions variable of an organization |
| `list_org_runners` | List the Actions runners of an organization |
| `get_org_runner` | Get an Actions runner of an organization |
| `register_org_runner` | Register a new Actions runner for an organization |
| `delete_org_runner` | Delete an Actions runner of an organization |
| `list_org_runner_jobs` | Search the Actions run jobs of an organization that are waiting for a runner, optionally filtered by labels |
| `set_my_action_secret` | Create or update an Actions secret for the authenticated user |
| `delete_my_action_secret` | Delete an Actions secret of the authenticated user |
| `list_my_action_variables` | List the Actions variables of the authenticated user |
| `get_my_action_variable` | Get an Actions variable of the authenticated user |
| `create_my_action_variable` | Create an Actions variable for the authenticated user |
| `update_my_action_variable` | Update the value (and optionally the name) of an Actions variable of the authenticated user |
| `delete_my_action_variable` | Delete an Actions variable of the authenticated user |
| `list_my_runners` | List the Actions runners of the authenticated user |
| `get_my_runner` | Get an Actions runner of the authenticated user |
| `register_my_runner` | Register a new Actions runner for the authenticated user |
| `delete_my_runner` | Delete an Actions runner of the authenticated user |
| `list_my_runner_jobs` | Search the Actions run jobs of the authenticated user that are waiting for a runner, optionally filtered by labels |
| `admin_list_runners` | List the Actions runners of the instance (requires admin privileges) |
| `admin_get_runner` | Get an Actions runner of the instance (requires admin privileges) |
| `admin_register_runner` | Register a new Actions runner for the instance (requires admin privileges) |
| `admin_delete_runner` | Delete an Actions runner of the instance (requires admin privileges) |

### Packages (6 tools)
| Tool | Description |
|------|-------------|
| `list_packages` | List all packages of an owner (user or organization) |
| `get_package` | Get a specific version of a package |
| `delete_package` | Delete a specific version of a package |
| `list_package_files` | List all files of a specific version of a package |
| `link_package` | Link a package to a repository of the same owner |
| `unlink_package` | Unlink a package from its repository |

### Admin & System (61 tools)
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
| `admin_list_emails` | List all users' email addresses (requires admin privileges) |
| `admin_search_emails` | Search users' email addresses (requires admin privileges) |
| `admin_list_user_emails` | List all email addresses for a user (requires admin privileges) |
| `admin_delete_user_emails` | Delete email addresses from a user's account (requires admin privileges) |
| `admin_create_hook` | Create a global (system) webhook (requires admin privileges) |
| `admin_get_hook` | Get a global (system) webhook (requires admin privileges) |
| `admin_edit_hook` | Update a global (system) webhook (requires admin privileges) |
| `admin_delete_hook` | Delete a global (system) webhook (requires admin privileges) |
| `admin_list_orgs` | List all organizations on the instance (requires admin privileges) |
| `admin_create_org` | Create an organization owned by a user (requires admin privileges) |
| `admin_create_repo` | Create a repository on behalf of a user (requires admin privileges) |
| `admin_rename_user` | Rename a user (requires admin privileges) |
| `admin_add_user_key` | Add an SSH public key to a user's account (requires admin privileges) |
| `admin_delete_user_key` | Remove an SSH public key from a user's account (requires admin privileges) |
| `admin_list_user_tokens` | List a user's access tokens (requires admin privileges) |
| `admin_create_user_token` | Create an access token for a user; the response contains the token secret (requires admin privileges) |
| `admin_delete_user_token` | Delete an access token of a user (requires admin privileges) |
| `admin_list_unadopted_repos` | List unadopted repositories (requires admin privileges) |
| `admin_adopt_repo` | Adopt unadopted files as a repository (requires admin privileges) |
| `admin_delete_unadopted_repo` | Delete unadopted repository files (requires admin privileges) |
| `admin_list_quota_groups` | List the available quota groups (requires admin privileges) |
| `admin_create_quota_group` | Create a new quota group (requires admin privileges) |
| `admin_get_quota_group` | Get information about a quota group (requires admin privileges) |
| `admin_delete_quota_group` | Delete a quota group (requires admin privileges) |
| `admin_add_quota_group_rule` | Add a rule to a quota group (requires admin privileges) |
| `admin_remove_quota_group_rule` | Remove a rule from a quota group (requires admin privileges) |
| `admin_list_quota_group_users` | List users in a quota group (requires admin privileges) |
| `admin_add_quota_group_user` | Add a user to a quota group (requires admin privileges) |
| `admin_remove_quota_group_user` | Remove a user from a quota group (requires admin privileges) |
| `admin_list_quota_rules` | List the available quota rules (requires admin privileges) |
| `admin_create_quota_rule` | Create a new quota rule (requires admin privileges) |
| `admin_get_quota_rule` | Get information about a quota rule (requires admin privileges) |
| `admin_edit_quota_rule` | Change an existing quota rule (requires admin privileges) |
| `admin_delete_quota_rule` | Delete a quota rule (requires admin privileges) |
| `admin_get_user_quota` | Get a user's quota info (requires admin privileges) |
| `admin_set_user_quota_groups` | Set a user's quota groups to the given list (requires admin privileges) |
| `get_api_settings` | Get the instance's global settings for the API |
| `get_attachment_settings` | Get the instance's global settings for attachments |
| `get_repository_settings` | Get the instance's global settings for repositories |
| `get_ui_settings` | Get the instance's global settings for the UI |
| `get_signing_key_gpg` | Get the instance's default GPG signing key |
| `get_signing_key_ssh` | Get the instance's default SSH signing key |

## Security

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FORGEJO_URL` | Yes | Base URL of your Forgejo/Gitea instance |
| `FORGEJO_TOKEN` | Yes | API token (generate at `{your-instance}/user/settings/applications`) |
| `FORGEJO_DISABLED_AREAS` | No | Comma-separated tool areas to disable (e.g. `admin,actions`); all are enabled by default |
| `FORGEJO_TIMEOUT_MS` | No | Give up on a Forgejo request after this long (default: 120000; `0` disables the timeout) |
| `FORGEJO_MAX_RESPONSE_BYTES` | No | Largest response read from Forgejo (default: 10485760, i.e. 10 MB). Larger logs, diffs, and files are truncated |
| `FORGEJO_MCP_API_KEY` | No | Bearer token for HTTP endpoint authentication. Required when using the provided `docker-compose.yml` |
| `RATE_LIMIT_MAX` | No | Max requests per rate limit window (default: 100) |
| `RATE_LIMIT_WINDOW_MS` | No | Rate limit window in ms (default: 60000) |
| `PORT` | No | HTTP server port (default: 3000) |

### Security Features
- **Input validation** - All parameters validated with Zod schemas (path traversal prevention, regex-validated usernames, bounded pagination, enum enforcement)
- **Request confinement** - Every request path is checked before it is sent, so a tool call cannot reach an endpoint other than its own
- **SSRF protection** - Base URL validated against cloud metadata endpoints and private IP ranges
- **Bounded requests** - Requests to Forgejo time out, responses are capped in size, and HTTP request bodies are limited to 16 MB
- **HTTP authentication** - Optional Bearer token auth for the HTTP transport
- **Rate limiting** - Per-IP rate limiting on HTTP endpoints
- **Token safety** - API tokens never leaked in error messages; URLs sanitized in errors
- **Security headers** - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
- **Non-root Docker** - Container runs as unprivileged user with read-only filesystem

### Best Practices
- Always use HTTPS for your Forgejo instance URL
- Use short-lived API tokens with minimal required permissions
- Set `FORGEJO_MCP_API_KEY` when running HTTP mode on a network (the provided `docker-compose.yml` enforces this)
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

### Releasing
Pushing a version tag that matches `package.json` (for example `0.2.0` or `v0.2.0`) runs `.forgejo/workflows/release.yml`, which lints, tests, builds, and publishes the package to npm. The workflow needs an `NPM_TOKEN` repository secret with publish rights.

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
