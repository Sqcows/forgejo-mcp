import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient, ForgejoApiError } from "../client.js";
import { formatResponse, formatError } from "./helpers.js";
import { zOwner, zRepo, zBranch, zPage, zLimit, zId, zName, zTitle, zBody, zSearchQuery, zVisibility, zTemplateName, zMarkdownMode } from "../validation.js";

export function registerAdminTools(server: McpServer, client: ForgejoClient): void {
  // ── Admin tools (require admin token) ──────────────────────────────

  // 1. admin_list_users
  server.tool(
    "admin_list_users",
    "List all users (requires admin privileges)",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/admin/users", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 2. admin_create_user
  server.tool(
    "admin_create_user",
    "Create a new user (requires admin privileges)",
    {
      username: zOwner.describe("Username for the new user"),
      email: z.string().email().describe("Email address for the new user"),
      password: z.string().min(6).max(255).describe("Password for the new user"),
      must_change_password: z.boolean().optional().describe("Whether the user must change password on first login"),
    },
    async (params) => {
      try {
        const data = await client.post("/admin/users", {
          username: params.username,
          email: params.email,
          password: params.password,
          must_change_password: params.must_change_password,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 3. admin_delete_user
  server.tool(
    "admin_delete_user",
    "Delete a user (requires admin privileges)",
    {
      username: zOwner.describe("Username of the user to delete"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/admin/users/${params.username}`);
        return formatResponse(data ?? "User deleted successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 4. admin_edit_user
  server.tool(
    "admin_edit_user",
    "Edit an existing user (requires admin privileges)",
    {
      username: zOwner.describe("Username of the user to edit"),
      email: z.string().email().optional().describe("New email address for the user"),
      active: z.boolean().optional().describe("Whether the user account is active"),
      admin: z.boolean().optional().describe("Whether the user has admin privileges"),
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {};
        if (params.email !== undefined) body.email = params.email;
        if (params.active !== undefined) body.active = params.active;
        if (params.admin !== undefined) body.admin = params.admin;
        const data = await client.patch(`/admin/users/${params.username}`, body);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 5. admin_list_cron_jobs
  server.tool(
    "admin_list_cron_jobs",
    "List all cron jobs (requires admin privileges)",
    {},
    async () => {
      try {
        const data = await client.get("/admin/cron");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 6. admin_run_cron_job
  server.tool(
    "admin_run_cron_job",
    "Run a cron task by name (requires admin privileges)",
    {
      task: zTemplateName.describe("Name of the cron task to run"),
    },
    async (params) => {
      try {
        const data = await client.post(`/admin/cron/${params.task}`);
        return formatResponse(data ?? "Cron job triggered successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 7. admin_list_hooks
  server.tool(
    "admin_list_hooks",
    "List system webhooks (requires admin privileges)",
    {},
    async () => {
      try {
        const data = await client.get("/admin/hooks");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Miscellaneous tools ────────────────────────────────────────────

  // 8. get_server_version
  server.tool(
    "get_server_version",
    "Get the Forgejo server version",
    {},
    async () => {
      try {
        const data = await client.get("/version");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 9. render_markdown
  server.tool(
    "render_markdown",
    "Render markdown text to HTML",
    {
      text: z.string().max(1_000_000).describe("Markdown text to render"),
      mode: zMarkdownMode.describe("Render mode: gfm, comment, or plain"),
      context: z.string().max(255).optional().describe("Context for resolving relative links (e.g. owner/repo)"),
    },
    async (params) => {
      try {
        const data = await client.post("/markdown", {
          Text: params.text,
          Mode: params.mode,
          Context: params.context,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 10. render_markup
  server.tool(
    "render_markup",
    "Render markup text to HTML",
    {
      text: z.string().max(1_000_000).describe("Markup text to render"),
      mode: z.string().max(50).optional().describe("Render mode"),
      context: z.string().max(255).optional().describe("Context for resolving relative links"),
      wiki: z.boolean().optional().describe("Whether the content is wiki content"),
    },
    async (params) => {
      try {
        const data = await client.post("/markup", {
          Text: params.text,
          Mode: params.mode,
          Context: params.context,
          Wiki: params.wiki,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 11. list_gitignore_templates
  server.tool(
    "list_gitignore_templates",
    "List all available gitignore templates",
    {},
    async () => {
      try {
        const data = await client.get("/gitignore/templates");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 12. get_gitignore_template
  server.tool(
    "get_gitignore_template",
    "Get a specific gitignore template by name",
    {
      name: zTemplateName.describe("Name of the gitignore template"),
    },
    async (params) => {
      try {
        const data = await client.get(`/gitignore/templates/${params.name}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 13. list_license_templates
  server.tool(
    "list_license_templates",
    "List all available license templates",
    {},
    async () => {
      try {
        const data = await client.get("/licenses");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 14. get_license_template
  server.tool(
    "get_license_template",
    "Get a specific license template by name",
    {
      name: zTemplateName.describe("Name of the license template"),
    },
    async (params) => {
      try {
        const data = await client.get(`/licenses/${params.name}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 15. list_label_templates
  server.tool(
    "list_label_templates",
    "List all available label templates",
    {},
    async () => {
      try {
        const data = await client.get("/label/templates");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 16. get_label_template
  server.tool(
    "get_label_template",
    "Get a specific label template by name",
    {
      name: zTemplateName.describe("Name of the label template"),
    },
    async (params) => {
      try {
        const data = await client.get(`/label/templates/${params.name}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 17. get_nodeinfo
  server.tool(
    "get_nodeinfo",
    "Get the Forgejo instance NodeInfo",
    {},
    async () => {
      try {
        const data = await client.get("/nodeinfo");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Actions tools ──────────────────────────────────────────────────

  // 18. list_action_runners_jobs
  server.tool(
    "list_action_runners_jobs",
    "List action runner jobs (requires admin privileges)",
    {
      labels: z.string().max(1024).optional().describe("Comma-separated list of runner labels to filter jobs by"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const query = { labels: params.labels, page: params.page, limit: params.limit };
        try {
          return formatResponse(await client.get("/admin/actions/runners/jobs", query));
        } catch (err) {
          // Older Forgejo releases only expose the legacy (now deprecated) path
          if (!(err instanceof ForgejoApiError) || err.status !== 404) throw err;
          return formatResponse(await client.get("/admin/runners/jobs", query));
        }
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 19. get_runner_registration_token
  server.tool(
    "get_runner_registration_token",
    "Get a runner registration token (requires admin privileges). Deprecated in Forgejo 16 in favour of admin_register_runner",
    {},
    async () => {
      try {
        const data = await client.get("/admin/runners/registration-token");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Admin: emails ───────────────────────────────────────────────────

  // 20. admin_list_emails
  server.tool(
    "admin_list_emails",
    "List all users' email addresses (requires admin privileges)",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/admin/emails", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 21. admin_search_emails
  server.tool(
    "admin_search_emails",
    "Search users' email addresses (requires admin privileges)",
    {
      q: zSearchQuery.optional().describe("Keyword to search for"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/admin/emails/search", {
          q: params.q,
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 22. admin_list_user_emails
  server.tool(
    "admin_list_user_emails",
    "List all email addresses for a user (requires admin privileges)",
    {
      username: zOwner.describe("Username of the user"),
    },
    async (params) => {
      try {
        const data = await client.get(`/admin/users/${params.username}/emails`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 23. admin_delete_user_emails
  server.tool(
    "admin_delete_user_emails",
    "Delete email addresses from a user's account (requires admin privileges)",
    {
      username: zOwner.describe("Username of the user"),
      emails: z.array(z.string().email()).min(1).describe("Email addresses to delete"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/admin/users/${params.username}/emails`, {
          emails: params.emails,
        });
        return formatResponse(data ?? "Email addresses deleted successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Admin: system webhooks ──────────────────────────────────────────

  // 24. admin_create_hook
  server.tool(
    "admin_create_hook",
    "Create a global (system) webhook (requires admin privileges)",
    {
      type: z.enum(["forgejo", "dingtalk", "discord", "gitea", "gogs", "msteams", "slack", "telegram", "feishu", "wechatwork", "packagist"]).describe("Webhook type"),
      config: z.record(z.string()).describe("Webhook config; \"url\" and \"content_type\" (json or form) are required"),
      events: z.array(z.string().max(255)).optional().describe("Events that trigger the webhook (e.g. push, pull_request)"),
      active: z.boolean().optional().describe("Whether the webhook is active (default false)"),
      branch_filter: z.string().max(255).optional().describe("Branch filter glob"),
      authorization_header: z.string().max(4096).optional().describe("Authorization header sent with webhook deliveries"),
    },
    async (params) => {
      try {
        const data = await client.post("/admin/hooks", {
          type: params.type,
          config: params.config,
          events: params.events,
          active: params.active,
          branch_filter: params.branch_filter,
          authorization_header: params.authorization_header,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 25. admin_get_hook
  server.tool(
    "admin_get_hook",
    "Get a global (system) webhook (requires admin privileges)",
    {
      id: zId.describe("ID of the webhook"),
    },
    async (params) => {
      try {
        const data = await client.get(`/admin/hooks/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 26. admin_edit_hook
  server.tool(
    "admin_edit_hook",
    "Update a global (system) webhook (requires admin privileges)",
    {
      id: zId.describe("ID of the webhook"),
      config: z.record(z.string()).optional().describe("Webhook config (e.g. url, content_type)"),
      events: z.array(z.string().max(255)).optional().describe("Events that trigger the webhook"),
      active: z.boolean().optional().describe("Whether the webhook is active"),
      branch_filter: z.string().max(255).optional().describe("Branch filter glob"),
      authorization_header: z.string().max(4096).optional().describe("Authorization header sent with webhook deliveries"),
    },
    async (params) => {
      try {
        const data = await client.patch(`/admin/hooks/${params.id}`, {
          config: params.config,
          events: params.events,
          active: params.active,
          branch_filter: params.branch_filter,
          authorization_header: params.authorization_header,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 27. admin_delete_hook
  server.tool(
    "admin_delete_hook",
    "Delete a global (system) webhook (requires admin privileges)",
    {
      id: zId.describe("ID of the webhook"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/admin/hooks/${params.id}`);
        return formatResponse(data ?? "Webhook deleted successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Admin: organizations, repositories and users ────────────────────

  // 28. admin_list_orgs
  server.tool(
    "admin_list_orgs",
    "List all organizations on the instance (requires admin privileges)",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/admin/orgs", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 29. admin_create_org
  server.tool(
    "admin_create_org",
    "Create an organization owned by a user (requires admin privileges)",
    {
      username: zOwner.describe("Username of the user who will own the organization"),
      org: zOwner.describe("Name of the organization to create"),
      full_name: zTitle.optional().describe("Full display name of the organization"),
      description: zBody.optional().describe("Organization description"),
      email: z.string().email().optional().describe("Contact email of the organization"),
      website: z.string().max(255).optional().describe("Organization website"),
      location: z.string().max(255).optional().describe("Organization location"),
      visibility: zVisibility.describe("Visibility: public, limited, or private"),
      repo_admin_change_team_access: z.boolean().optional().describe("Whether repo admins can change team access"),
    },
    async (params) => {
      try {
        const data = await client.post(`/admin/users/${params.username}/orgs`, {
          username: params.org,
          full_name: params.full_name,
          description: params.description,
          email: params.email,
          website: params.website,
          location: params.location,
          visibility: params.visibility,
          repo_admin_change_team_access: params.repo_admin_change_team_access,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 30. admin_create_repo
  server.tool(
    "admin_create_repo",
    "Create a repository on behalf of a user (requires admin privileges)",
    {
      username: zOwner.describe("Username of the user who will own the repository"),
      name: zRepo.describe("Name of the repository to create"),
      description: zBody.optional().describe("Repository description"),
      private: z.boolean().optional().describe("Whether the repository is private"),
      auto_init: z.boolean().optional().describe("Whether to auto-initialize the repository"),
      default_branch: zBranch.optional().describe("Default branch name"),
      gitignores: z.string().max(255).optional().describe("Gitignore templates to use, comma-separated"),
      license: z.string().max(255).optional().describe("License template to use"),
      readme: z.string().max(255).optional().describe("Readme template to use"),
      issue_labels: z.string().max(255).optional().describe("Label set to use"),
      template: z.boolean().optional().describe("Whether the repository is a template"),
      object_format_name: z.enum(["sha1", "sha256"]).optional().describe("Object format of the underlying git repository"),
      trust_model: z.enum(["default", "collaborator", "committer", "collaboratorcommitter"]).optional().describe("Trust model of the repository"),
    },
    async (params) => {
      try {
        const data = await client.post(`/admin/users/${params.username}/repos`, {
          name: params.name,
          description: params.description,
          private: params.private,
          auto_init: params.auto_init,
          default_branch: params.default_branch,
          gitignores: params.gitignores,
          license: params.license,
          readme: params.readme,
          issue_labels: params.issue_labels,
          template: params.template,
          object_format_name: params.object_format_name,
          trust_model: params.trust_model,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 31. admin_rename_user
  server.tool(
    "admin_rename_user",
    "Rename a user (requires admin privileges)",
    {
      username: zOwner.describe("Current username of the user"),
      new_username: zOwner.describe("New username"),
    },
    async (params) => {
      try {
        const data = await client.post(`/admin/users/${params.username}/rename`, {
          new_username: params.new_username,
        });
        return formatResponse(data ?? "User renamed successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 32. admin_add_user_key
  server.tool(
    "admin_add_user_key",
    "Add an SSH public key to a user's account (requires admin privileges)",
    {
      username: zOwner.describe("Username of the user"),
      title: zTitle.describe("Title of the key"),
      key: z.string().min(1).max(16384).describe("SSH public key (armored)"),
      read_only: z.boolean().optional().describe("Whether the key has only read access"),
    },
    async (params) => {
      try {
        const data = await client.post(`/admin/users/${params.username}/keys`, {
          title: params.title,
          key: params.key,
          read_only: params.read_only,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 33. admin_delete_user_key
  server.tool(
    "admin_delete_user_key",
    "Remove an SSH public key from a user's account (requires admin privileges)",
    {
      username: zOwner.describe("Username of the user"),
      id: zId.describe("ID of the key to delete"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/admin/users/${params.username}/keys/${params.id}`);
        return formatResponse(data ?? "Key deleted successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 34. admin_list_user_tokens
  server.tool(
    "admin_list_user_tokens",
    "List a user's access tokens (requires admin privileges)",
    {
      username: zOwner.describe("Username of the user"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/admin/users/${params.username}/tokens`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 35. admin_create_user_token
  server.tool(
    "admin_create_user_token",
    "Create an access token for a user; the response contains the token secret (requires admin privileges)",
    {
      username: zOwner.describe("Username of the user"),
      name: zTitle.describe("Name of the access token"),
      scopes: z.array(z.string().max(255)).optional().describe("Token scopes (e.g. read:repository, write:issue, all)"),
      repositories: z.array(z.object({
        owner: zOwner,
        name: zRepo,
      })).optional().describe("If provided and non-empty, restricts the token to these repositories"),
    },
    async (params) => {
      try {
        const data = await client.post(`/admin/users/${params.username}/tokens`, {
          name: params.name,
          scopes: params.scopes,
          repositories: params.repositories,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 36. admin_delete_user_token
  server.tool(
    "admin_delete_user_token",
    "Delete an access token of a user (requires admin privileges)",
    {
      username: zOwner.describe("Username of the user"),
      token: zName.describe("Token to delete, identified by ID or, if not available, by name"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/admin/users/${params.username}/tokens/${params.token}`);
        return formatResponse(data ?? "Access token deleted successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Admin: unadopted repositories ───────────────────────────────────

  // 37. admin_list_unadopted_repos
  server.tool(
    "admin_list_unadopted_repos",
    "List unadopted repositories (requires admin privileges)",
    {
      page: zPage,
      limit: zLimit,
      pattern: z.string().max(255).optional().describe("Pattern of repositories to search for"),
    },
    async (params) => {
      try {
        const data = await client.get("/admin/unadopted", {
          page: params.page,
          limit: params.limit,
          pattern: params.pattern,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 38. admin_adopt_repo
  server.tool(
    "admin_adopt_repo",
    "Adopt unadopted files as a repository (requires admin privileges)",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.post(`/admin/unadopted/${params.owner}/${params.repo}`);
        return formatResponse(data ?? "Repository adopted successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 39. admin_delete_unadopted_repo
  server.tool(
    "admin_delete_unadopted_repo",
    "Delete unadopted repository files (requires admin privileges)",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.delete(`/admin/unadopted/${params.owner}/${params.repo}`);
        return formatResponse(data ?? "Unadopted files deleted successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Admin: quota ────────────────────────────────────────────────────

  // 40. admin_list_quota_groups
  server.tool(
    "admin_list_quota_groups",
    "List the available quota groups (requires admin privileges)",
    {},
    async () => {
      try {
        const data = await client.get("/admin/quota/groups");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 41. admin_create_quota_group
  server.tool(
    "admin_create_quota_group",
    "Create a new quota group (requires admin privileges)",
    {
      name: zName.describe("Name of the quota group to create"),
      rules: z.array(z.object({
        name: zName.describe("Name of the rule"),
        limit: z.number().int().optional().describe("The limit set by the rule, in bytes (-1 for unlimited)"),
        subjects: z.array(z.string().max(255)).optional().describe("The subjects affected by the rule (e.g. size:all, size:repos:all)"),
      })).optional().describe("Rules to add to the new group; rules that do not exist are created"),
    },
    async (params) => {
      try {
        const data = await client.post("/admin/quota/groups", {
          name: params.name,
          rules: params.rules,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 42. admin_get_quota_group
  server.tool(
    "admin_get_quota_group",
    "Get information about a quota group (requires admin privileges)",
    {
      quotagroup: zName.describe("Name of the quota group"),
    },
    async (params) => {
      try {
        const data = await client.get(`/admin/quota/groups/${params.quotagroup}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 43. admin_delete_quota_group
  server.tool(
    "admin_delete_quota_group",
    "Delete a quota group (requires admin privileges)",
    {
      quotagroup: zName.describe("Name of the quota group"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/admin/quota/groups/${params.quotagroup}`);
        return formatResponse(data ?? "Quota group deleted successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 44. admin_add_quota_group_rule
  server.tool(
    "admin_add_quota_group_rule",
    "Add a rule to a quota group (requires admin privileges)",
    {
      quotagroup: zName.describe("Name of the quota group"),
      quotarule: zName.describe("Name of the quota rule to add"),
    },
    async (params) => {
      try {
        const data = await client.put(`/admin/quota/groups/${params.quotagroup}/rules/${params.quotarule}`);
        return formatResponse(data ?? "Rule added to quota group successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 45. admin_remove_quota_group_rule
  server.tool(
    "admin_remove_quota_group_rule",
    "Remove a rule from a quota group (requires admin privileges)",
    {
      quotagroup: zName.describe("Name of the quota group"),
      quotarule: zName.describe("Name of the quota rule to remove"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/admin/quota/groups/${params.quotagroup}/rules/${params.quotarule}`);
        return formatResponse(data ?? "Rule removed from quota group successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 46. admin_list_quota_group_users
  server.tool(
    "admin_list_quota_group_users",
    "List users in a quota group (requires admin privileges)",
    {
      quotagroup: zName.describe("Name of the quota group"),
    },
    async (params) => {
      try {
        const data = await client.get(`/admin/quota/groups/${params.quotagroup}/users`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 47. admin_add_quota_group_user
  server.tool(
    "admin_add_quota_group_user",
    "Add a user to a quota group (requires admin privileges)",
    {
      quotagroup: zName.describe("Name of the quota group"),
      username: zOwner.describe("Username of the user to add"),
    },
    async (params) => {
      try {
        const data = await client.put(`/admin/quota/groups/${params.quotagroup}/users/${params.username}`);
        return formatResponse(data ?? "User added to quota group successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 48. admin_remove_quota_group_user
  server.tool(
    "admin_remove_quota_group_user",
    "Remove a user from a quota group (requires admin privileges)",
    {
      quotagroup: zName.describe("Name of the quota group"),
      username: zOwner.describe("Username of the user to remove"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/admin/quota/groups/${params.quotagroup}/users/${params.username}`);
        return formatResponse(data ?? "User removed from quota group successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 49. admin_list_quota_rules
  server.tool(
    "admin_list_quota_rules",
    "List the available quota rules (requires admin privileges)",
    {},
    async () => {
      try {
        const data = await client.get("/admin/quota/rules");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 50. admin_create_quota_rule
  server.tool(
    "admin_create_quota_rule",
    "Create a new quota rule (requires admin privileges)",
    {
      name: zName.describe("Name of the rule to create"),
      limit: z.number().int().optional().describe("The limit set by the rule, in bytes (-1 for unlimited)"),
      subjects: z.array(z.string().max(255)).optional().describe("The subjects affected by the rule (e.g. size:all, size:repos:all)"),
    },
    async (params) => {
      try {
        const data = await client.post("/admin/quota/rules", {
          name: params.name,
          limit: params.limit,
          subjects: params.subjects,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 51. admin_get_quota_rule
  server.tool(
    "admin_get_quota_rule",
    "Get information about a quota rule (requires admin privileges)",
    {
      quotarule: zName.describe("Name of the quota rule"),
    },
    async (params) => {
      try {
        const data = await client.get(`/admin/quota/rules/${params.quotarule}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 52. admin_edit_quota_rule
  server.tool(
    "admin_edit_quota_rule",
    "Change an existing quota rule (requires admin privileges)",
    {
      quotarule: zName.describe("Name of the quota rule"),
      limit: z.number().int().optional().describe("The limit set by the rule, in bytes (-1 for unlimited)"),
      subjects: z.array(z.string().max(255)).optional().describe("The subjects affected by the rule"),
    },
    async (params) => {
      try {
        const data = await client.patch(`/admin/quota/rules/${params.quotarule}`, {
          limit: params.limit,
          subjects: params.subjects,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 53. admin_delete_quota_rule
  server.tool(
    "admin_delete_quota_rule",
    "Delete a quota rule (requires admin privileges)",
    {
      quotarule: zName.describe("Name of the quota rule"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/admin/quota/rules/${params.quotarule}`);
        return formatResponse(data ?? "Quota rule deleted successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 54. admin_get_user_quota
  server.tool(
    "admin_get_user_quota",
    "Get a user's quota info (requires admin privileges)",
    {
      username: zOwner.describe("Username of the user"),
    },
    async (params) => {
      try {
        const data = await client.get(`/admin/users/${params.username}/quota`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 55. admin_set_user_quota_groups
  server.tool(
    "admin_set_user_quota_groups",
    "Set a user's quota groups to the given list (requires admin privileges)",
    {
      username: zOwner.describe("Username of the user"),
      groups: z.array(zName).describe("Quota groups the user shall have"),
    },
    async (params) => {
      try {
        const data = await client.post(`/admin/users/${params.username}/quota/groups`, {
          groups: params.groups,
        });
        return formatResponse(data ?? "User quota groups updated successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Instance settings ───────────────────────────────────────────────

  // 56. get_api_settings
  server.tool(
    "get_api_settings",
    "Get the instance's global settings for the API",
    {},
    async () => {
      try {
        const data = await client.get("/settings/api");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 57. get_attachment_settings
  server.tool(
    "get_attachment_settings",
    "Get the instance's global settings for attachments",
    {},
    async () => {
      try {
        const data = await client.get("/settings/attachment");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 58. get_repository_settings
  server.tool(
    "get_repository_settings",
    "Get the instance's global settings for repositories",
    {},
    async () => {
      try {
        const data = await client.get("/settings/repository");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 59. get_ui_settings
  server.tool(
    "get_ui_settings",
    "Get the instance's global settings for the UI",
    {},
    async () => {
      try {
        const data = await client.get("/settings/ui");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Signing keys ────────────────────────────────────────────────────

  // 60. get_signing_key_gpg
  server.tool(
    "get_signing_key_gpg",
    "Get the instance's default GPG signing key",
    {},
    async () => {
      try {
        const data = await client.getRaw("/signing-key.gpg");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 61. get_signing_key_ssh
  server.tool(
    "get_signing_key_ssh",
    "Get the instance's default SSH signing key",
    {},
    async () => {
      try {
        const data = await client.getRaw("/signing-key.ssh");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
