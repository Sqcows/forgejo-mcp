import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient } from "../client.js";
import { formatResponse, formatError } from "./helpers.js";
import { zOwner, zPage, zLimit, zTemplateName, zTitle, zBody, zMarkdownMode } from "../validation.js";

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
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/admin/runners/jobs", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 19. get_runner_registration_token
  server.tool(
    "get_runner_registration_token",
    "Get a runner registration token (requires admin privileges)",
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
}
