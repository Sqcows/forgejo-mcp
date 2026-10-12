import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient } from "./client.js";
import type { ForgejoConfig, ToolArea } from "./config.js";
import { registerRepositoryTools } from "./tools/repository.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerPullRequestTools } from "./tools/pullrequests.js";
import { registerOrganizationTools } from "./tools/organizations.js";
import { registerUserTools } from "./tools/users.js";
import { registerAdminTools } from "./tools/admin.js";
import { registerRepoSettingsTools } from "./tools/repo-settings.js";
import { registerActionsTools } from "./tools/actions.js";
import { registerPackageTools } from "./tools/packages.js";

/**
 * Read the version from package.json at runtime so the server version never
 * drifts from the published package version. Resolves relative to this module,
 * which sits one level below the package root both in src/ (tsx) and dist/.
 */
function resolveVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const SERVER_VERSION = resolveVersion();

interface ToolGroup {
  area: ToolArea;
  label: string;
  register: (server: McpServer, client: ForgejoClient) => void;
  tools: string;
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    area: "repository",
    label: "Repository",
    register: registerRepositoryTools,
    tools: "search_repos, get_repo, create_repo, create_org_repo, delete_repo, fork_repo, list_branches, get_branch, create_branch, delete_branch, list_repo_commits, get_file_contents, create_file, update_file, delete_file, list_releases, create_release, list_tags, list_repo_topics, update_repo_topics, list_forks, list_collaborators, add_collaborator, edit_repo, transfer_repo, get_release, get_latest_release, get_release_by_tag, edit_release, delete_release, delete_release_by_tag, list_release_assets, get_release_asset, edit_release_asset, delete_release_asset, create_tag, get_tag, delete_tag, get_commit, get_commit_diff, compare_commits, get_combined_commit_status, list_commit_statuses_by_ref, list_commit_statuses, create_commit_status, list_repo_contents, change_files, get_raw_file, get_editorconfig, apply_diff_patch, get_git_tree, get_git_blob, get_git_blobs, list_git_refs, get_git_ref, get_annotated_tag, get_commit_note, set_commit_note, delete_commit_note, rename_branch, list_repo_languages, list_stargazers, list_repo_watchers, get_repo_subscription, watch_repo, unwatch_repo, list_repo_assignees, list_repo_reviewers, list_repo_activity_feeds, check_collaborator, remove_collaborator, get_collaborator_permission, add_repo_topic, delete_repo_topic, search_topics, get_repo_by_id, list_issue_templates, get_issue_config, validate_issue_config",
  },
  {
    area: "repo-settings",
    label: "Repository Settings",
    register: registerRepoSettingsTools,
    tools: "list_repo_hooks, get_repo_hook, create_repo_hook, edit_repo_hook, delete_repo_hook, test_repo_hook, list_branch_protections, get_branch_protection, create_branch_protection, edit_branch_protection, delete_branch_protection, list_tag_protections, get_tag_protection, create_tag_protection, edit_tag_protection, delete_tag_protection, list_deploy_keys, get_deploy_key, add_deploy_key, delete_deploy_key, list_push_mirrors, get_push_mirror, add_push_mirror, delete_push_mirror, sync_push_mirrors, sync_mirror, convert_mirror_repo, list_repo_teams, check_repo_team, add_repo_team, remove_repo_team, list_wiki_pages, get_wiki_page, create_wiki_page, edit_wiki_page, delete_wiki_page, list_wiki_page_revisions, migrate_repo, generate_repo_from_template, get_sync_fork_info, sync_fork, accept_repo_transfer, reject_repo_transfer, list_repo_flags, replace_repo_flags, clear_repo_flags, check_repo_flag, add_repo_flag, remove_repo_flag, get_repo_signing_key",
  },
  {
    area: "issues",
    label: "Issues",
    register: registerIssueTools,
    tools: "list_issues, get_issue, create_issue, edit_issue, list_issue_comments, create_issue_comment, edit_issue_comment, delete_issue_comment, list_labels, get_label, create_label, edit_label, delete_label, add_issue_labels, remove_issue_label, list_milestones, get_milestone, create_milestone, edit_milestone, delete_milestone, search_issues, delete_issue, list_repo_comments, get_issue_comment, list_issue_reactions, add_issue_reaction, remove_issue_reaction, list_comment_reactions, add_comment_reaction, remove_comment_reaction, list_issue_dependencies, add_issue_dependency, remove_issue_dependency, list_issue_blocks, add_issue_block, remove_issue_block, get_issue_labels, replace_issue_labels, clear_issue_labels, pin_issue, unpin_issue, move_issue_pin, list_pinned_issues, check_new_pin_allowed, set_issue_deadline, list_issue_timeline, list_issue_tracked_times, add_issue_tracked_time, reset_issue_tracked_times, delete_issue_tracked_time, list_repo_tracked_times, start_issue_stopwatch, stop_issue_stopwatch, delete_issue_stopwatch, list_issue_subscriptions, check_issue_subscription, subscribe_issue, unsubscribe_issue, list_issue_attachments, get_issue_attachment, edit_issue_attachment, delete_issue_attachment, list_comment_attachments, get_comment_attachment, edit_comment_attachment, delete_comment_attachment",
  },
  {
    area: "pull-requests",
    label: "Pull Requests",
    register: registerPullRequestTools,
    tools: "list_pull_requests, get_pull_request, create_pull_request, edit_pull_request, merge_pull_request, list_pr_commits, list_pr_files, get_pr_diff, list_pr_reviews, create_pr_review, request_pr_review, update_pr_branch, get_pr_patch, is_pr_merged, cancel_pr_auto_merge, cancel_pr_review_request, get_pr_review, submit_pr_review, delete_pr_review, list_pr_review_comments, create_pr_review_comment, get_pr_review_comment, delete_pr_review_comment, dismiss_pr_review, undismiss_pr_review, get_pr_by_base_head, list_pinned_pull_requests, get_commit_pull_request",
  },
  {
    area: "organizations",
    label: "Organizations",
    register: registerOrganizationTools,
    tools: "list_orgs, get_org, create_org, edit_org, delete_org, list_org_repos, list_org_members, list_org_teams, get_team, create_team, add_team_member, remove_team_member, list_org_labels, list_org_hooks, create_org_hook, get_org_hook, edit_org_hook, delete_org_hook, create_org_label, get_org_label, edit_org_label, delete_org_label, check_org_member, remove_org_member, list_org_public_members, check_org_public_member, publicize_org_membership, conceal_org_membership, list_org_blocked_users, org_block_user, org_unblock_user, get_org_quota, list_org_quota_artifacts, list_org_quota_attachments, list_org_quota_packages, check_org_quota, rename_org, search_org_teams, list_org_activity_feeds, list_team_activity_feeds, edit_team, delete_team, list_team_members, get_team_member, list_team_repos, get_team_repo, add_team_repo, remove_team_repo, list_my_orgs, get_user_org_permissions",
  },
  {
    area: "users",
    label: "Users",
    register: registerUserTools,
    tools: "get_authenticated_user, get_user, list_user_repos, list_user_orgs, search_users, list_followers, list_following, list_user_starred, list_my_starred, star_repo, unstar_repo, list_my_notifications, mark_notifications_read, check_new_notifications, get_notification_thread, mark_notification_thread_read, list_repo_notifications, mark_repo_notifications_read, list_my_followers, list_my_following, check_my_following, follow_user, unfollow_user, check_user_following, list_my_emails, add_my_emails, delete_my_emails, list_my_ssh_keys, create_my_ssh_key, get_my_ssh_key, delete_my_ssh_key, list_user_ssh_keys, list_my_gpg_keys, add_my_gpg_key, get_my_gpg_key, delete_my_gpg_key, get_gpg_key_verification_token, verify_my_gpg_key, list_user_gpg_keys, list_my_hooks, create_my_hook, get_my_hook, edit_my_hook, delete_my_hook, list_my_blocked_users, block_user, unblock_user, get_my_quota, list_my_quota_artifacts, list_my_quota_attachments, list_my_quota_packages, check_my_quota, list_my_repos, get_my_settings, update_my_settings, check_repo_starred, list_my_stopwatches, list_my_subscriptions, list_user_subscriptions, list_my_teams, list_my_tracked_times, list_user_activity_feeds, get_user_heatmap",
  },
  {
    area: "actions",
    label: "Actions",
    register: registerActionsTools,
    tools: "list_action_runs, get_action_run, delete_action_run, cancel_action_run, list_action_run_jobs, get_action_job_logs, list_action_run_artifacts, list_action_artifacts, get_action_artifact, delete_action_artifact, list_action_tasks, dispatch_workflow, list_repo_action_secrets, set_repo_action_secret, delete_repo_action_secret, list_repo_action_variables, get_repo_action_variable, create_repo_action_variable, update_repo_action_variable, delete_repo_action_variable, list_repo_runners, get_repo_runner, register_repo_runner, delete_repo_runner, list_repo_runner_jobs, list_org_action_secrets, set_org_action_secret, delete_org_action_secret, list_org_action_variables, get_org_action_variable, create_org_action_variable, update_org_action_variable, delete_org_action_variable, list_org_runners, get_org_runner, register_org_runner, delete_org_runner, list_org_runner_jobs, set_my_action_secret, delete_my_action_secret, list_my_action_variables, get_my_action_variable, create_my_action_variable, update_my_action_variable, delete_my_action_variable, list_my_runners, get_my_runner, register_my_runner, delete_my_runner, list_my_runner_jobs, admin_list_runners, admin_get_runner, admin_register_runner, admin_delete_runner",
  },
  {
    area: "packages",
    label: "Packages",
    register: registerPackageTools,
    tools: "list_packages, get_package, delete_package, list_package_files, link_package, unlink_package",
  },
  {
    area: "admin",
    label: "Admin",
    register: registerAdminTools,
    tools: "admin_list_users, admin_create_user, admin_delete_user, admin_edit_user, admin_list_cron_jobs, admin_run_cron_job, admin_list_hooks, get_server_version, render_markdown, render_markup, list_gitignore_templates, get_gitignore_template, list_license_templates, get_license_template, list_label_templates, get_label_template, get_nodeinfo, list_action_runners_jobs, get_runner_registration_token, admin_list_emails, admin_search_emails, admin_list_user_emails, admin_delete_user_emails, admin_create_hook, admin_get_hook, admin_edit_hook, admin_delete_hook, admin_list_orgs, admin_create_org, admin_create_repo, admin_rename_user, admin_add_user_key, admin_delete_user_key, admin_list_user_tokens, admin_create_user_token, admin_delete_user_token, admin_list_unadopted_repos, admin_adopt_repo, admin_delete_unadopted_repo, admin_list_quota_groups, admin_create_quota_group, admin_get_quota_group, admin_delete_quota_group, admin_add_quota_group_rule, admin_remove_quota_group_rule, admin_list_quota_group_users, admin_add_quota_group_user, admin_remove_quota_group_user, admin_list_quota_rules, admin_create_quota_rule, admin_get_quota_rule, admin_edit_quota_rule, admin_delete_quota_rule, admin_get_user_quota, admin_set_user_quota_groups, get_api_settings, get_attachment_settings, get_repository_settings, get_ui_settings, get_signing_key_gpg, get_signing_key_ssh",
  },
];

function buildInstructions(groups: ToolGroup[]): string {
  return `This MCP server connects to a Forgejo (or Gitea) instance and provides tools to interact with its API.

## Tool categories

${groups.map((group) => `- **${group.label}**: ${group.tools}`).join("\n")}

## Conventions

- Most tools require \`owner\` and \`repo\` parameters to identify a repository.
- List endpoints support pagination with \`page\` (starting at 1) and \`limit\` (1–50) parameters.
- Tool names use snake_case with a domain prefix for admin tools (e.g. \`admin_list_users\`).
- Tools for the authenticated user contain \`my\` (e.g. \`list_my_ssh_keys\`); organization-scoped tools contain \`org\`.
- File content parameters (create_file, update_file, change_files, create_wiki_page) expect base64-encoded content.
- \`check_*\` tools return "Success" when the condition holds and a 404 error when it does not.
- The server returns JSON responses from the Forgejo API, or error messages with HTTP status codes on failure.
`;
}

export function createServer(config: ForgejoConfig): McpServer {
  const disabled = new Set(config.disabledAreas ?? []);
  const groups = TOOL_GROUPS.filter((group) => !disabled.has(group.area));

  const server = new McpServer(
    {
      name: "forgejo-mcp",
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        logging: {},
      },
      instructions: buildInstructions(groups),
    }
  );

  const client = new ForgejoClient(config);

  for (const group of groups) {
    group.register(server, client);
  }

  return server;
}
