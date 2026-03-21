import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient } from "./client.js";
import type { ForgejoConfig } from "./config.js";
import { registerRepositoryTools } from "./tools/repository.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerPullRequestTools } from "./tools/pullrequests.js";
import { registerOrganizationTools } from "./tools/organizations.js";
import { registerUserTools } from "./tools/users.js";
import { registerAdminTools } from "./tools/admin.js";

const SERVER_INSTRUCTIONS = `This MCP server connects to a Forgejo (or Gitea) instance and provides tools to interact with its API.

## Tool categories

- **Repository**: search_repos, get_repo, create_repo, create_org_repo, delete_repo, fork_repo, edit_repo, transfer_repo, list_branches, get_branch, create_branch, delete_branch, list_repo_commits, get_file_contents, create_file, update_file, delete_file, list_releases, create_release, list_tags, list_repo_topics, update_repo_topics, list_forks, list_collaborators, add_collaborator
- **Issues**: list_issues, get_issue, create_issue, edit_issue, list_issue_comments, create_issue_comment, edit_issue_comment, delete_issue_comment, list_labels, get_label, create_label, edit_label, delete_label, add_issue_labels, remove_issue_label, list_milestones, get_milestone, create_milestone, edit_milestone, delete_milestone
- **Pull Requests**: list_pull_requests, get_pull_request, create_pull_request, edit_pull_request, merge_pull_request, list_pr_commits, list_pr_files, get_pr_diff, list_pr_reviews, create_pr_review, request_pr_review, update_pr_branch
- **Organizations**: list_orgs, get_org, create_org, edit_org, delete_org, list_org_repos, list_org_members, list_org_teams, get_team, create_team, add_team_member, remove_team_member, list_org_labels, list_org_hooks
- **Users**: get_authenticated_user, get_user, list_user_repos, list_user_orgs, search_users, list_followers, list_following, list_user_starred, list_my_starred, star_repo, unstar_repo, list_my_notifications, mark_notifications_read
- **Admin**: admin_list_users, admin_create_user, admin_delete_user, admin_edit_user, admin_list_cron_jobs, admin_run_cron_job, admin_list_hooks, get_server_version, render_markdown, render_markup, list_gitignore_templates, get_gitignore_template, list_license_templates, get_license_template, list_label_templates, get_label_template, get_nodeinfo, list_action_runners_jobs, get_runner_registration_token

## Conventions

- Most tools require \`owner\` and \`repo\` parameters to identify a repository.
- List endpoints support pagination with \`page\` (starting at 1) and \`limit\` (1–50) parameters.
- Tool names use snake_case with a domain prefix for admin tools (e.g. \`admin_list_users\`).
- File content parameters (create_file, update_file) expect base64-encoded content.
- The server returns JSON responses from the Forgejo API, or error messages with HTTP status codes on failure.
`;

export function createServer(config: ForgejoConfig): McpServer {
  const server = new McpServer(
    {
      name: "forgejo-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        logging: {},
      },
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  const client = new ForgejoClient(config);

  registerRepositoryTools(server, client);
  registerIssueTools(server, client);
  registerPullRequestTools(server, client);
  registerOrganizationTools(server, client);
  registerUserTools(server, client);
  registerAdminTools(server, client);

  return server;
}
