import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient } from "../client.js";
import { formatResponse, formatError, encodePath } from "./helpers.js";
import {
  zOwner,
  zRepo,
  zBranch,
  zPage,
  zLimit,
  zId,
  zName,
  zRef,
  zWikiPage,
  zTitle,
  zBody,
} from "../validation.js";

const zHookType = z.enum([
  "forgejo",
  "dingtalk",
  "discord",
  "gitea",
  "gogs",
  "msteams",
  "slack",
  "telegram",
  "feishu",
  "wechatwork",
  "packagist",
]);

const zHookConfig = z.record(z.string().max(4096));

/** Branch protection rule name; may be a glob like release/*, so it is URL-encoded by the tool */
const zRuleName = z
  .string()
  .min(1)
  .max(255)
  .refine((val) => !val.includes(".."), "Rule name must not contain '..'")
  .describe("Branch protection rule name");

/** Settings shared by create_branch_protection and edit_branch_protection */
const branchProtectionFields = {
  enable_push: z.boolean().optional().describe("Allow pushing to the branch"),
  enable_push_whitelist: z.boolean().optional().describe("Restrict pushing to whitelisted users/teams"),
  push_whitelist_usernames: z.array(z.string()).optional().describe("Usernames allowed to push"),
  push_whitelist_teams: z.array(z.string()).optional().describe("Team names allowed to push"),
  push_whitelist_deploy_keys: z.boolean().optional().describe("Allow deploy keys with write access to push"),
  enable_merge_whitelist: z.boolean().optional().describe("Restrict merging to whitelisted users/teams"),
  merge_whitelist_usernames: z.array(z.string()).optional().describe("Usernames allowed to merge"),
  merge_whitelist_teams: z.array(z.string()).optional().describe("Team names allowed to merge"),
  enable_status_check: z.boolean().optional().describe("Require status checks to pass before merging"),
  status_check_contexts: z.array(z.string()).optional().describe("Required status check contexts"),
  required_approvals: z.number().int().min(0).optional().describe("Number of required approvals"),
  enable_approvals_whitelist: z.boolean().optional().describe("Restrict approvals to whitelisted users/teams"),
  approvals_whitelist_username: z.array(z.string()).optional().describe("Usernames whose approvals count"),
  approvals_whitelist_teams: z.array(z.string()).optional().describe("Team names whose approvals count"),
  block_on_rejected_reviews: z.boolean().optional().describe("Block merging when changes are requested"),
  block_on_official_review_requests: z.boolean().optional().describe("Block merging while official review requests are pending"),
  block_on_outdated_branch: z.boolean().optional().describe("Block merging when the head branch is behind the base branch"),
  dismiss_stale_approvals: z.boolean().optional().describe("Dismiss approvals when new commits are pushed"),
  ignore_stale_approvals: z.boolean().optional().describe("Do not count approvals made on older commits"),
  require_signed_commits: z.boolean().optional().describe("Reject pushes with unsigned or unverifiable commits"),
  protected_file_patterns: z.string().max(4096).optional().describe("Semicolon-separated glob patterns of protected files"),
  unprotected_file_patterns: z.string().max(4096).optional().describe("Semicolon-separated glob patterns of unprotected files"),
  apply_to_admins: z.boolean().optional().describe("Apply the rule to repository admins too"),
};

export function registerRepoSettingsTools(server: McpServer, client: ForgejoClient): void {
  // 1. list_repo_hooks
  server.tool(
    "list_repo_hooks",
    "List the webhooks in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/hooks`,
          { page: params.page, limit: params.limit }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 2. get_repo_hook
  server.tool(
    "get_repo_hook",
    "Get a repository webhook by ID",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Webhook ID"),
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/hooks/${params.id}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 3. create_repo_hook
  server.tool(
    "create_repo_hook",
    "Create a webhook in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      type: zHookType.describe("Webhook type"),
      config: zHookConfig.describe("Hook config; \"url\" and \"content_type\" (json or form) are required, \"secret\" is optional"),
      events: z.array(z.string().max(255)).optional().describe("Events that trigger the hook (e.g. push, pull_request, issues)"),
      branch_filter: z.string().max(255).optional().describe("Branch filter glob (e.g. main or release/*)"),
      authorization_header: z.string().max(4096).optional().describe("Authorization header value sent with each delivery"),
      active: z.boolean().optional().describe("Whether the hook is active"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/hooks`,
          {
            type: params.type,
            config: params.config,
            events: params.events,
            branch_filter: params.branch_filter,
            authorization_header: params.authorization_header,
            active: params.active,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 4. edit_repo_hook
  server.tool(
    "edit_repo_hook",
    "Edit a webhook in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Webhook ID"),
      config: zHookConfig.optional().describe("Hook config (url, content_type, secret)"),
      events: z.array(z.string().max(255)).optional().describe("Events that trigger the hook (e.g. push, pull_request, issues)"),
      branch_filter: z.string().max(255).optional().describe("Branch filter glob (e.g. main or release/*)"),
      authorization_header: z.string().max(4096).optional().describe("Authorization header value sent with each delivery"),
      active: z.boolean().optional().describe("Whether the hook is active"),
    },
    async (params) => {
      try {
        const data = await client.patch(
          `/repos/${params.owner}/${params.repo}/hooks/${params.id}`,
          {
            config: params.config,
            events: params.events,
            branch_filter: params.branch_filter,
            authorization_header: params.authorization_header,
            active: params.active,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 5. delete_repo_hook
  server.tool(
    "delete_repo_hook",
    "Delete a webhook from a repository",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Webhook ID"),
    },
    async (params) => {
      try {
        const data = await client.delete(
          `/repos/${params.owner}/${params.repo}/hooks/${params.id}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 6. test_repo_hook
  server.tool(
    "test_repo_hook",
    "Send a test push event to a repository webhook",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Webhook ID"),
      ref: zRef.optional().describe("Git ref to use for the test payload (defaults to the default branch)"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/hooks/${params.id}/tests`,
          undefined,
          { ref: params.ref }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 7. list_branch_protections
  server.tool(
    "list_branch_protections",
    "List branch protection rules for a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/branch_protections`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 8. get_branch_protection
  server.tool(
    "get_branch_protection",
    "Get a branch protection rule by name",
    {
      owner: zOwner,
      repo: zRepo,
      name: zRuleName,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/branch_protections/${encodeURIComponent(params.name)}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 9. create_branch_protection
  server.tool(
    "create_branch_protection",
    "Create a branch protection rule for a repository",
    {
      owner: zOwner,
      repo: zRepo,
      rule_name: z.string().min(1).max(255).describe("Rule name / branch name pattern (e.g. main or release/*)"),
      ...branchProtectionFields,
    },
    async (params) => {
      try {
        const { owner, repo, ...body } = params;
        const data = await client.post(
          `/repos/${owner}/${repo}/branch_protections`,
          body
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 10. edit_branch_protection
  server.tool(
    "edit_branch_protection",
    "Edit a branch protection rule. Only fields that are set will be changed",
    {
      owner: zOwner,
      repo: zRepo,
      name: zRuleName,
      ...branchProtectionFields,
    },
    async (params) => {
      try {
        const { owner, repo, name, ...body } = params;
        const data = await client.patch(
          `/repos/${owner}/${repo}/branch_protections/${encodeURIComponent(name)}`,
          body
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 11. delete_branch_protection
  server.tool(
    "delete_branch_protection",
    "Delete a branch protection rule",
    {
      owner: zOwner,
      repo: zRepo,
      name: zRuleName,
    },
    async (params) => {
      try {
        const data = await client.delete(
          `/repos/${params.owner}/${params.repo}/branch_protections/${encodeURIComponent(params.name)}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 12. list_tag_protections
  server.tool(
    "list_tag_protections",
    "List tag protection rules for a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/tag_protections`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 13. get_tag_protection
  server.tool(
    "get_tag_protection",
    "Get a tag protection rule by ID",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Tag protection ID"),
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/tag_protections/${params.id}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 14. create_tag_protection
  server.tool(
    "create_tag_protection",
    "Create a tag protection rule for a repository",
    {
      owner: zOwner,
      repo: zRepo,
      name_pattern: z.string().min(1).max(255).describe("Tag name pattern (glob or /regex/)"),
      whitelist_usernames: z.array(z.string()).optional().describe("Usernames allowed to create matching tags"),
      whitelist_teams: z.array(z.string()).optional().describe("Team names allowed to create matching tags"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/tag_protections`,
          {
            name_pattern: params.name_pattern,
            whitelist_usernames: params.whitelist_usernames,
            whitelist_teams: params.whitelist_teams,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 15. edit_tag_protection
  server.tool(
    "edit_tag_protection",
    "Edit a tag protection rule. Only fields that are set will be changed",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Tag protection ID"),
      name_pattern: z.string().min(1).max(255).optional().describe("Tag name pattern (glob or /regex/)"),
      whitelist_usernames: z.array(z.string()).optional().describe("Usernames allowed to create matching tags"),
      whitelist_teams: z.array(z.string()).optional().describe("Team names allowed to create matching tags"),
    },
    async (params) => {
      try {
        const data = await client.patch(
          `/repos/${params.owner}/${params.repo}/tag_protections/${params.id}`,
          {
            name_pattern: params.name_pattern,
            whitelist_usernames: params.whitelist_usernames,
            whitelist_teams: params.whitelist_teams,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 16. delete_tag_protection
  server.tool(
    "delete_tag_protection",
    "Delete a tag protection rule",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Tag protection ID"),
    },
    async (params) => {
      try {
        const data = await client.delete(
          `/repos/${params.owner}/${params.repo}/tag_protections/${params.id}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 17. list_deploy_keys
  server.tool(
    "list_deploy_keys",
    "List a repository's deploy keys",
    {
      owner: zOwner,
      repo: zRepo,
      key_id: zId.optional().describe("Filter by the ID of the underlying public key"),
      fingerprint: z.string().max(255).optional().describe("Filter by key fingerprint"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/keys`,
          {
            key_id: params.key_id,
            fingerprint: params.fingerprint,
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 18. get_deploy_key
  server.tool(
    "get_deploy_key",
    "Get a repository deploy key by ID",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Deploy key ID"),
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/keys/${params.id}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 19. add_deploy_key
  server.tool(
    "add_deploy_key",
    "Add a deploy key to a repository",
    {
      owner: zOwner,
      repo: zRepo,
      title: zTitle.describe("Title of the key"),
      key: z.string().min(1).max(16384).describe("Armored SSH public key"),
      read_only: z.boolean().optional().describe("Whether the key has read-only access (default: true)"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/keys`,
          {
            title: params.title,
            key: params.key,
            read_only: params.read_only,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 20. delete_deploy_key
  server.tool(
    "delete_deploy_key",
    "Delete a deploy key from a repository",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Deploy key ID"),
    },
    async (params) => {
      try {
        const data = await client.delete(
          `/repos/${params.owner}/${params.repo}/keys/${params.id}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 21. list_push_mirrors
  server.tool(
    "list_push_mirrors",
    "List the push mirrors of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/push_mirrors`,
          { page: params.page, limit: params.limit }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 22. get_push_mirror
  server.tool(
    "get_push_mirror",
    "Get a push mirror of a repository by its remote name",
    {
      owner: zOwner,
      repo: zRepo,
      name: zName.describe("Remote name of the push mirror"),
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/push_mirrors/${params.name}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 23. add_push_mirror
  server.tool(
    "add_push_mirror",
    "Set up a new push mirror in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      remote_address: z.string().min(1).max(2048).describe("URL of the remote repository to push to"),
      remote_username: z.string().max(255).optional().describe("Username for the remote"),
      remote_password: z.string().max(4096).optional().describe("Password or token for the remote"),
      interval: z.string().max(64).optional().describe("Sync interval as a Go duration (e.g. 8h0m0s)"),
      sync_on_commit: z.boolean().optional().describe("Push to the mirror whenever new commits are pushed"),
      use_ssh: z.boolean().optional().describe("Authenticate with a generated SSH keypair instead of username/password"),
      branch_filter: z.string().max(4096).optional().describe("Comma-separated branch globs to mirror"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/push_mirrors`,
          {
            remote_address: params.remote_address,
            remote_username: params.remote_username,
            remote_password: params.remote_password,
            interval: params.interval,
            sync_on_commit: params.sync_on_commit,
            use_ssh: params.use_ssh,
            branch_filter: params.branch_filter,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 24. delete_push_mirror
  server.tool(
    "delete_push_mirror",
    "Remove a push mirror from a repository by its remote name",
    {
      owner: zOwner,
      repo: zRepo,
      name: zName.describe("Remote name of the push mirror"),
    },
    async (params) => {
      try {
        const data = await client.delete(
          `/repos/${params.owner}/${params.repo}/push_mirrors/${params.name}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 25. sync_push_mirrors
  server.tool(
    "sync_push_mirrors",
    "Trigger a sync of all push mirrors of a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/push_mirrors-sync`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 26. sync_mirror
  server.tool(
    "sync_mirror",
    "Trigger a sync of a pull-mirrored repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/mirror-sync`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 27. convert_mirror_repo
  server.tool(
    "convert_mirror_repo",
    "Convert a mirror repository to a normal repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/convert`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 28. list_repo_teams
  server.tool(
    "list_repo_teams",
    "List the teams assigned to a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/teams`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 29. check_repo_team
  server.tool(
    "check_repo_team",
    "Check if a team is assigned to a repository",
    {
      owner: zOwner,
      repo: zRepo,
      team: zName.describe("Team name"),
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/teams/${params.team}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 30. add_repo_team
  server.tool(
    "add_repo_team",
    "Assign a team to a repository",
    {
      owner: zOwner,
      repo: zRepo,
      team: zName.describe("Team name"),
    },
    async (params) => {
      try {
        const data = await client.put(
          `/repos/${params.owner}/${params.repo}/teams/${params.team}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 31. remove_repo_team
  server.tool(
    "remove_repo_team",
    "Remove a team from a repository",
    {
      owner: zOwner,
      repo: zRepo,
      team: zName.describe("Team name"),
    },
    async (params) => {
      try {
        const data = await client.delete(
          `/repos/${params.owner}/${params.repo}/teams/${params.team}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 32. list_wiki_pages
  server.tool(
    "list_wiki_pages",
    "List all wiki pages of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/wiki/pages`,
          { page: params.page, limit: params.limit }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 33. get_wiki_page
  server.tool(
    "get_wiki_page",
    "Get a wiki page (content is returned base64 encoded)",
    {
      owner: zOwner,
      repo: zRepo,
      page_name: zWikiPage,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/wiki/page/${encodeURIComponent(params.page_name)}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 34. create_wiki_page
  server.tool(
    "create_wiki_page",
    "Create a wiki page",
    {
      owner: zOwner,
      repo: zRepo,
      title: zTitle.describe("Page title"),
      content_base64: z.string().max(10_485_760).describe("Base64 encoded page content (Markdown)"),
      message: zTitle.optional().describe("Commit message"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/wiki/new`,
          {
            title: params.title,
            content_base64: params.content_base64,
            message: params.message,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 35. edit_wiki_page
  server.tool(
    "edit_wiki_page",
    "Edit a wiki page",
    {
      owner: zOwner,
      repo: zRepo,
      page_name: zWikiPage,
      title: zTitle.optional().describe("New page title"),
      content_base64: z.string().max(10_485_760).optional().describe("Base64 encoded new page content (Markdown)"),
      message: zTitle.optional().describe("Commit message"),
    },
    async (params) => {
      try {
        const data = await client.patch(
          `/repos/${params.owner}/${params.repo}/wiki/page/${encodeURIComponent(params.page_name)}`,
          {
            title: params.title,
            content_base64: params.content_base64,
            message: params.message,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 36. delete_wiki_page
  server.tool(
    "delete_wiki_page",
    "Delete a wiki page",
    {
      owner: zOwner,
      repo: zRepo,
      page_name: zWikiPage,
    },
    async (params) => {
      try {
        const data = await client.delete(
          `/repos/${params.owner}/${params.repo}/wiki/page/${encodeURIComponent(params.page_name)}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 37. list_wiki_page_revisions
  server.tool(
    "list_wiki_page_revisions",
    "List the revisions of a wiki page",
    {
      owner: zOwner,
      repo: zRepo,
      page_name: zWikiPage,
      page: zPage,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/wiki/revisions/${encodeURIComponent(params.page_name)}`,
          { page: params.page }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 38. migrate_repo
  server.tool(
    "migrate_repo",
    "Migrate (import) a remote git repository, optionally as a mirror",
    {
      clone_addr: z.string().min(1).max(2048).describe("URL of the remote repository to migrate"),
      repo_name: zRepo.describe("Name of the new repository"),
      repo_owner: zOwner.optional().describe("User or organization that will own the new repository (defaults to the authenticated user)"),
      service: z.enum(["git", "github", "gitea", "gitlab", "gogs", "onedev", "gitbucket", "codebase", "forgejo", "pagure"]).optional().describe("Source service type (default: git)"),
      auth_username: z.string().max(255).optional().describe("Username for the remote"),
      auth_password: z.string().max(4096).optional().describe("Password for the remote"),
      auth_token: z.string().max(4096).optional().describe("Access token for the remote (needed to migrate issues, PRs, etc.)"),
      description: zBody.optional().describe("Repository description"),
      private: z.boolean().optional().describe("Whether the new repository is private"),
      mirror: z.boolean().optional().describe("Create the repository as a pull mirror"),
      mirror_interval: z.string().max(64).optional().describe("Mirror sync interval as a Go duration (e.g. 8h0m0s)"),
      wiki: z.boolean().optional().describe("Migrate the wiki"),
      issues: z.boolean().optional().describe("Migrate issues"),
      pull_requests: z.boolean().optional().describe("Migrate pull requests"),
      labels: z.boolean().optional().describe("Migrate labels"),
      milestones: z.boolean().optional().describe("Migrate milestones"),
      releases: z.boolean().optional().describe("Migrate releases"),
      lfs: z.boolean().optional().describe("Migrate LFS objects"),
      lfs_endpoint: z.string().max(2048).optional().describe("Custom LFS endpoint URL"),
    },
    async (params) => {
      try {
        const data = await client.post(
          "/repos/migrate",
          {
            clone_addr: params.clone_addr,
            repo_name: params.repo_name,
            repo_owner: params.repo_owner,
            service: params.service,
            auth_username: params.auth_username,
            auth_password: params.auth_password,
            auth_token: params.auth_token,
            description: params.description,
            private: params.private,
            mirror: params.mirror,
            mirror_interval: params.mirror_interval,
            wiki: params.wiki,
            issues: params.issues,
            pull_requests: params.pull_requests,
            labels: params.labels,
            milestones: params.milestones,
            releases: params.releases,
            lfs: params.lfs,
            lfs_endpoint: params.lfs_endpoint,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 39. generate_repo_from_template
  server.tool(
    "generate_repo_from_template",
    "Create a new repository from a template repository",
    {
      template_owner: zOwner.describe("Owner of the template repository"),
      template_repo: zRepo.describe("Name of the template repository"),
      owner: zOwner.describe("User or organization that will own the new repository"),
      name: zRepo.describe("Name of the new repository"),
      description: zBody.optional().describe("Description of the new repository"),
      private: z.boolean().optional().describe("Whether the new repository is private"),
      default_branch: zBranch.optional().describe("Default branch of the new repository"),
      git_content: z.boolean().optional().describe("Include the template's git content (default branch)"),
      topics: z.boolean().optional().describe("Include the template's topics"),
      labels: z.boolean().optional().describe("Include the template's labels"),
      webhooks: z.boolean().optional().describe("Include the template's webhooks"),
      git_hooks: z.boolean().optional().describe("Include the template's git hooks"),
      avatar: z.boolean().optional().describe("Include the template's avatar"),
      protected_branch: z.boolean().optional().describe("Include the template's branch protections"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.template_owner}/${params.template_repo}/generate`,
          {
            owner: params.owner,
            name: params.name,
            description: params.description,
            private: params.private,
            default_branch: params.default_branch,
            git_content: params.git_content,
            topics: params.topics,
            labels: params.labels,
            webhooks: params.webhooks,
            git_hooks: params.git_hooks,
            avatar: params.avatar,
            protected_branch: params.protected_branch,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 40. get_sync_fork_info
  server.tool(
    "get_sync_fork_info",
    "Get information about syncing a fork branch with its base repository (commits behind, whether a sync is possible)",
    {
      owner: zOwner,
      repo: zRepo,
      branch: zRef.optional().describe("Fork branch to sync (defaults to the default branch)"),
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/sync_fork${params.branch ? `/${encodePath(params.branch)}` : ""}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 41. sync_fork
  server.tool(
    "sync_fork",
    "Sync a fork branch with the base repository's branch",
    {
      owner: zOwner,
      repo: zRepo,
      branch: zRef.optional().describe("Fork branch to sync (defaults to the default branch)"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/sync_fork${params.branch ? `/${encodePath(params.branch)}` : ""}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 42. accept_repo_transfer
  server.tool(
    "accept_repo_transfer",
    "Accept a pending repository transfer",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/transfer/accept`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 43. reject_repo_transfer
  server.tool(
    "reject_repo_transfer",
    "Reject a pending repository transfer",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/transfer/reject`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 44. list_repo_flags
  server.tool(
    "list_repo_flags",
    "List a repository's flags (instance admin only)",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/flags`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 45. replace_repo_flags
  server.tool(
    "replace_repo_flags",
    "Replace all flags of a repository (instance admin only)",
    {
      owner: zOwner,
      repo: zRepo,
      flags: z.array(zName).describe("Flags to set on the repository"),
    },
    async (params) => {
      try {
        const data = await client.put(
          `/repos/${params.owner}/${params.repo}/flags`,
          { flags: params.flags }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 46. clear_repo_flags
  server.tool(
    "clear_repo_flags",
    "Remove all flags from a repository (instance admin only)",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.delete(
          `/repos/${params.owner}/${params.repo}/flags`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 47. check_repo_flag
  server.tool(
    "check_repo_flag",
    "Check if a repository has a given flag (instance admin only)",
    {
      owner: zOwner,
      repo: zRepo,
      flag: zName.describe("Flag name"),
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/flags/${params.flag}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 48. add_repo_flag
  server.tool(
    "add_repo_flag",
    "Add a flag to a repository (instance admin only)",
    {
      owner: zOwner,
      repo: zRepo,
      flag: zName.describe("Flag name"),
    },
    async (params) => {
      try {
        const data = await client.put(
          `/repos/${params.owner}/${params.repo}/flags/${params.flag}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 49. remove_repo_flag
  server.tool(
    "remove_repo_flag",
    "Remove a flag from a repository (instance admin only)",
    {
      owner: zOwner,
      repo: zRepo,
      flag: zName.describe("Flag name"),
    },
    async (params) => {
      try {
        const data = await client.delete(
          `/repos/${params.owner}/${params.repo}/flags/${params.flag}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 50. get_repo_signing_key
  server.tool(
    "get_repo_signing_key",
    "Get the GPG public key used to sign commits made by the instance in a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.getRaw(
          `/repos/${params.owner}/${params.repo}/signing-key.gpg`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
