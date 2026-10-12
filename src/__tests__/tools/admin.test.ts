import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient } from "../../client.js";
import { registerAdminTools } from "../../tools/admin.js";

function createMockClient() {
  const client = new ForgejoClient({ baseUrl: "https://example.com", token: "test" });
  client.get = vi.fn().mockResolvedValue({});
  client.post = vi.fn().mockResolvedValue({});
  client.patch = vi.fn().mockResolvedValue({});
  client.put = vi.fn().mockResolvedValue({});
  client.delete = vi.fn().mockResolvedValue(undefined);
  client.request = vi.fn().mockResolvedValue(undefined);
  client.getRaw = vi.fn().mockResolvedValue("");
  return client;
}

describe("Admin Tools", () => {
  it("registers all admin tools without error", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    expect(() => registerAdminTools(server, client)).not.toThrow();
  });

  it("registers expected tool names", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerAdminTools(server, client);

    const tools = (server as any)._registeredTools;
    const expectedTools = [
      "admin_list_users",
      "admin_create_user",
      "admin_delete_user",
      "admin_edit_user",
      "admin_list_cron_jobs",
      "admin_run_cron_job",
      "admin_list_hooks",
      "get_server_version",
      "render_markdown",
      "render_markup",
      "list_gitignore_templates",
      "get_gitignore_template",
      "list_license_templates",
      "get_license_template",
      "list_label_templates",
      "get_label_template",
      "get_nodeinfo",
      "list_action_runners_jobs",
      "get_runner_registration_token",
      "admin_list_emails",
      "admin_search_emails",
      "admin_list_user_emails",
      "admin_delete_user_emails",
      "admin_create_hook",
      "admin_get_hook",
      "admin_edit_hook",
      "admin_delete_hook",
      "admin_list_orgs",
      "admin_create_org",
      "admin_create_repo",
      "admin_rename_user",
      "admin_add_user_key",
      "admin_delete_user_key",
      "admin_list_user_tokens",
      "admin_create_user_token",
      "admin_delete_user_token",
      "admin_list_unadopted_repos",
      "admin_adopt_repo",
      "admin_delete_unadopted_repo",
      "admin_list_quota_groups",
      "admin_create_quota_group",
      "admin_get_quota_group",
      "admin_delete_quota_group",
      "admin_add_quota_group_rule",
      "admin_remove_quota_group_rule",
      "admin_list_quota_group_users",
      "admin_add_quota_group_user",
      "admin_remove_quota_group_user",
      "admin_list_quota_rules",
      "admin_create_quota_rule",
      "admin_get_quota_rule",
      "admin_edit_quota_rule",
      "admin_delete_quota_rule",
      "admin_get_user_quota",
      "admin_set_user_quota_groups",
      "get_api_settings",
      "get_attachment_settings",
      "get_repository_settings",
      "get_ui_settings",
      "get_signing_key_gpg",
      "get_signing_key_ssh",
    ];

    for (const toolName of expectedTools) {
      expect(tools[toolName], `Tool "${toolName}" should be registered`).toBeDefined();
    }
  });

  it("registers exactly 61 admin/misc tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerAdminTools(server, client);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBe(61);
  });

  describe("tool handler behavior", () => {
    let server: McpServer;
    let client: ReturnType<typeof createMockClient>;

    beforeEach(() => {
      server = new McpServer({ name: "test", version: "0.0.1" });
      client = createMockClient();
      registerAdminTools(server, client);
    });

    it("admin_list_users calls client.get with /admin/users", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const tools = (server as any)._registeredTools;
      const handler = tools["admin_list_users"].handler;
      await handler({ page: 1, limit: 20 });

      expect(client.get).toHaveBeenCalledWith("/admin/users", {
        page: 1,
        limit: 20,
      });
    });

    it("admin_create_user sends correct body", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

      const tools = (server as any)._registeredTools;
      const handler = tools["admin_create_user"].handler;
      await handler({
        username: "newuser",
        email: "new@example.com",
        password: "secret123",
        must_change_password: true,
      });

      expect(client.post).toHaveBeenCalledWith("/admin/users", {
        username: "newuser",
        email: "new@example.com",
        password: "secret123",
        must_change_password: true,
      });
    });

    it("admin_delete_user calls client.delete", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["admin_delete_user"].handler;
      await handler({ username: "baduser" });

      expect(client.delete).toHaveBeenCalledWith("/admin/users/baduser");
    });

    it("admin_edit_user sends only provided fields", async () => {
      (client.patch as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const tools = (server as any)._registeredTools;
      const handler = tools["admin_edit_user"].handler;
      await handler({ username: "user1", admin: true });

      expect(client.patch).toHaveBeenCalledWith("/admin/users/user1", { admin: true });
    });

    it("get_server_version calls client.get with /version", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ version: "1.0.0" });

      const tools = (server as any)._registeredTools;
      const handler = tools["get_server_version"].handler;
      await handler({});

      expect(client.get).toHaveBeenCalledWith("/version");
    });

    it("render_markdown sends correct body", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue("<p>Hello</p>");

      const tools = (server as any)._registeredTools;
      const handler = tools["render_markdown"].handler;
      await handler({ text: "# Hello", mode: "gfm" });

      expect(client.post).toHaveBeenCalledWith("/markdown", {
        Text: "# Hello",
        Mode: "gfm",
        Context: undefined,
      });
    });

    it("admin_run_cron_job calls client.post with task name", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const tools = (server as any)._registeredTools;
      const handler = tools["admin_run_cron_job"].handler;
      await handler({ task: "repo_health_check" });

      expect(client.post).toHaveBeenCalledWith("/admin/cron/repo_health_check");
    });

    it("admin_search_emails passes query and pagination", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["admin_search_emails"].handler;
      await handler({ q: "example.com", page: 2, limit: 10 });

      expect(client.get).toHaveBeenCalledWith("/admin/emails/search", {
        q: "example.com",
        page: 2,
        limit: 10,
      });
    });

    it("admin_delete_user_emails sends emails in the delete body", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["admin_delete_user_emails"].handler;
      await handler({ username: "user1", emails: ["old@example.com"] });

      expect(client.delete).toHaveBeenCalledWith("/admin/users/user1/emails", {
        emails: ["old@example.com"],
      });
    });

    it("admin_create_hook sends correct body", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["admin_create_hook"].handler;
      await handler({
        type: "forgejo",
        config: { url: "https://hooks.example.com", content_type: "json" },
        events: ["push"],
        active: true,
      });

      expect(client.post).toHaveBeenCalledWith("/admin/hooks", {
        type: "forgejo",
        config: { url: "https://hooks.example.com", content_type: "json" },
        events: ["push"],
        active: true,
        branch_filter: undefined,
        authorization_header: undefined,
      });
    });

    it("admin_delete_hook calls client.delete with hook id", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["admin_delete_hook"].handler;
      await handler({ id: 7 });

      expect(client.delete).toHaveBeenCalledWith("/admin/hooks/7");
    });

    it("admin_create_org maps org to username in the body", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["admin_create_org"].handler;
      await handler({ username: "user1", org: "neworg", visibility: "private" });

      expect(client.post).toHaveBeenCalledWith(
        "/admin/users/user1/orgs",
        expect.objectContaining({ username: "neworg", visibility: "private" })
      );
    });

    it("admin_create_repo posts to the user's repos", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["admin_create_repo"].handler;
      await handler({ username: "user1", name: "newrepo", private: true });

      expect(client.post).toHaveBeenCalledWith(
        "/admin/users/user1/repos",
        expect.objectContaining({ name: "newrepo", private: true })
      );
    });

    it("admin_rename_user sends new_username", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const tools = (server as any)._registeredTools;
      const handler = tools["admin_rename_user"].handler;
      await handler({ username: "old", new_username: "new" });

      expect(client.post).toHaveBeenCalledWith("/admin/users/old/rename", { new_username: "new" });
    });

    it("admin_delete_user_key calls client.delete with key id", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["admin_delete_user_key"].handler;
      await handler({ username: "user1", id: 3 });

      expect(client.delete).toHaveBeenCalledWith("/admin/users/user1/keys/3");
    });

    it("admin_create_user_token sends name and scopes", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["admin_create_user_token"].handler;
      await handler({ username: "user1", name: "ci", scopes: ["read:repository"] });

      expect(client.post).toHaveBeenCalledWith("/admin/users/user1/tokens", {
        name: "ci",
        scopes: ["read:repository"],
        repositories: undefined,
      });
    });

    it("admin_list_unadopted_repos passes pattern", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["admin_list_unadopted_repos"].handler;
      await handler({ pattern: "user1/*" });

      expect(client.get).toHaveBeenCalledWith("/admin/unadopted", {
        page: undefined,
        limit: undefined,
        pattern: "user1/*",
      });
    });

    it("admin_adopt_repo posts to the unadopted path", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const tools = (server as any)._registeredTools;
      const handler = tools["admin_adopt_repo"].handler;
      await handler({ owner: "user1", repo: "orphan" });

      expect(client.post).toHaveBeenCalledWith("/admin/unadopted/user1/orphan");
    });

    it("admin_create_quota_rule sends correct body", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["admin_create_quota_rule"].handler;
      await handler({ name: "git-1g", limit: 1073741824, subjects: ["size:repos:all"] });

      expect(client.post).toHaveBeenCalledWith("/admin/quota/rules", {
        name: "git-1g",
        limit: 1073741824,
        subjects: ["size:repos:all"],
      });
    });

    it("admin_add_quota_group_rule calls client.put", async () => {
      (client.put as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const tools = (server as any)._registeredTools;
      const handler = tools["admin_add_quota_group_rule"].handler;
      await handler({ quotagroup: "default", quotarule: "git-1g" });

      expect(client.put).toHaveBeenCalledWith("/admin/quota/groups/default/rules/git-1g");
    });

    it("admin_remove_quota_group_user calls client.delete", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["admin_remove_quota_group_user"].handler;
      await handler({ quotagroup: "default", username: "user1" });

      expect(client.delete).toHaveBeenCalledWith("/admin/quota/groups/default/users/user1");
    });

    it("admin_set_user_quota_groups sends groups", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const tools = (server as any)._registeredTools;
      const handler = tools["admin_set_user_quota_groups"].handler;
      await handler({ username: "user1", groups: ["default"] });

      expect(client.post).toHaveBeenCalledWith("/admin/users/user1/quota/groups", { groups: ["default"] });
    });

    it("get_repository_settings calls client.get with /settings/repository", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["get_repository_settings"].handler;
      await handler({});

      expect(client.get).toHaveBeenCalledWith("/settings/repository");
    });

    it("get_signing_key_gpg calls client.getRaw", async () => {
      (client.getRaw as ReturnType<typeof vi.fn>).mockResolvedValue("-----BEGIN PGP PUBLIC KEY BLOCK-----");

      const tools = (server as any)._registeredTools;
      const handler = tools["get_signing_key_gpg"].handler;
      const result = await handler({});

      expect(client.getRaw).toHaveBeenCalledWith("/signing-key.gpg");
      expect(result.content[0].text).toContain("BEGIN PGP");
    });

    it("handler returns error response on failure", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Admin access required"));

      const tools = (server as any)._registeredTools;
      const handler = tools["admin_list_users"].handler;
      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Admin access required");
    });
  });
});
