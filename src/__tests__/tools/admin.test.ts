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
    ];

    for (const toolName of expectedTools) {
      expect(tools[toolName], `Tool "${toolName}" should be registered`).toBeDefined();
    }
  });

  it("registers exactly 19 admin/misc tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerAdminTools(server, client);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBe(19);
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
