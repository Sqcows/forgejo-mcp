import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient } from "../../client.js";
import { registerOrganizationTools } from "../../tools/organizations.js";

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

describe("Organization Tools", () => {
  it("registers all organization tools without error", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    expect(() => registerOrganizationTools(server, client)).not.toThrow();
  });

  it("registers expected tool names", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerOrganizationTools(server, client);

    const tools = (server as any)._registeredTools;
    const expectedTools = [
      "list_orgs",
      "get_org",
      "create_org",
      "edit_org",
      "delete_org",
      "list_org_repos",
      "list_org_members",
      "list_org_teams",
      "get_team",
      "create_team",
      "add_team_member",
      "remove_team_member",
      "list_org_labels",
      "list_org_hooks",
      "create_org_hook",
      "get_org_hook",
      "edit_org_hook",
      "delete_org_hook",
      "create_org_label",
      "get_org_label",
      "edit_org_label",
      "delete_org_label",
      "check_org_member",
      "remove_org_member",
      "list_org_public_members",
      "check_org_public_member",
      "publicize_org_membership",
      "conceal_org_membership",
      "list_org_blocked_users",
      "org_block_user",
      "org_unblock_user",
      "get_org_quota",
      "list_org_quota_artifacts",
      "list_org_quota_attachments",
      "list_org_quota_packages",
      "check_org_quota",
      "rename_org",
      "search_org_teams",
      "list_org_activity_feeds",
      "list_team_activity_feeds",
      "edit_team",
      "delete_team",
      "list_team_members",
      "get_team_member",
      "list_team_repos",
      "get_team_repo",
      "add_team_repo",
      "remove_team_repo",
      "list_my_orgs",
      "get_user_org_permissions",
    ];

    for (const toolName of expectedTools) {
      expect(tools[toolName], `Tool "${toolName}" should be registered`).toBeDefined();
    }
  });

  it("registers exactly 50 organization tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerOrganizationTools(server, client);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBe(50);
  });

  describe("tool handler behavior", () => {
    let server: McpServer;
    let client: ReturnType<typeof createMockClient>;

    beforeEach(() => {
      server = new McpServer({ name: "test", version: "0.0.1" });
      client = createMockClient();
      registerOrganizationTools(server, client);
    });

    it("create_org sends correct body", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

      const tools = (server as any)._registeredTools;
      const handler = tools["create_org"].handler;
      await handler({ username: "myorg", description: "My org", visibility: "public" });

      expect(client.post).toHaveBeenCalledWith("/orgs", {
        username: "myorg",
        full_name: undefined,
        description: "My org",
        visibility: "public",
      });
    });

    it("create_team defaults units when none are provided", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 9 });

      const tools = (server as any)._registeredTools;
      const handler = tools["create_team"].handler;
      await handler({ org: "myorg", name: "devs", permission: "write" });

      const [path, body] = (client.post as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(path).toBe("/orgs/myorg/teams");
      expect(body.name).toBe("devs");
      expect(Array.isArray(body.units)).toBe(true);
      expect(body.units.length).toBeGreaterThan(0);
      expect(body.units).toContain("repo.code");
    });

    it("create_team respects explicitly provided units", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 10 });

      const tools = (server as any)._registeredTools;
      const handler = tools["create_team"].handler;
      await handler({ org: "myorg", name: "readers", permission: "read", units: ["repo.code"] });

      const [, body] = (client.post as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(body.units).toEqual(["repo.code"]);
    });

    it("add_team_member calls client.put with correct path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["add_team_member"].handler;
      await handler({ id: 5, username: "newuser" });

      expect(client.put).toHaveBeenCalledWith("/teams/5/members/newuser");
    });

    it("delete_org calls client.delete", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["delete_org"].handler;
      await handler({ org: "oldorg" });

      expect(client.delete).toHaveBeenCalledWith("/orgs/oldorg");
    });

    it("create_org_hook posts hook options", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["create_org_hook"].handler;
      await handler({ org: "my-org", type: "forgejo", config: { url: "https://example.com/hook", content_type: "json" }, events: ["push"], active: true });

      expect(client.post).toHaveBeenCalledWith("/orgs/my-org/hooks", {
        type: "forgejo",
        config: { url: "https://example.com/hook", content_type: "json" },
        events: ["push"],
        active: true,
        branch_filter: undefined,
        authorization_header: undefined,
      });
    });

    it("delete_org_hook calls client.delete with hook path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["delete_org_hook"].handler;
      await handler({ org: "my-org", id: 4 });

      expect(client.delete).toHaveBeenCalledWith("/orgs/my-org/hooks/4");
    });

    it("edit_org_label patches label fields", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["edit_org_label"].handler;
      await handler({ org: "my-org", id: 9, name: "bug", color: "#ff0000" });

      expect(client.patch).toHaveBeenCalledWith("/orgs/my-org/labels/9", {
        name: "bug",
        color: "#ff0000",
        description: undefined,
        exclusive: undefined,
        is_archived: undefined,
      });
    });

    it("remove_org_member calls client.delete with member path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["remove_org_member"].handler;
      await handler({ org: "my-org", username: "alice" });

      expect(client.delete).toHaveBeenCalledWith("/orgs/my-org/members/alice");
    });

    it("publicize_org_membership calls client.put", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["publicize_org_membership"].handler;
      await handler({ org: "my-org", username: "alice" });

      expect(client.put).toHaveBeenCalledWith("/orgs/my-org/public_members/alice");
    });

    it("org_block_user calls client.put with block path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["org_block_user"].handler;
      await handler({ org: "my-org", username: "spammer" });

      expect(client.put).toHaveBeenCalledWith("/orgs/my-org/block/spammer");
    });

    it("check_org_quota passes subject as query param", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["check_org_quota"].handler;
      await handler({ org: "my-org", subject: "size:all" });

      expect(client.get).toHaveBeenCalledWith("/orgs/my-org/quota/check", { subject: "size:all" });
    });

    it("rename_org posts new_name", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["rename_org"].handler;
      await handler({ org: "old-org", new_name: "new-org" });

      expect(client.post).toHaveBeenCalledWith("/orgs/old-org/rename", { new_name: "new-org" });
    });

    it("search_org_teams passes search params", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["search_org_teams"].handler;
      await handler({ org: "my-org", q: "dev", include_desc: true, page: 1, limit: 10 });

      expect(client.get).toHaveBeenCalledWith("/orgs/my-org/teams/search", {
        q: "dev",
        include_desc: true,
        page: 1,
        limit: 10,
      });
    });

    it("list_org_activity_feeds passes date and pagination", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["list_org_activity_feeds"].handler;
      await handler({ org: "my-org", date: "2026-01-02", page: 2 });

      expect(client.get).toHaveBeenCalledWith("/orgs/my-org/activities/feeds", {
        date: "2026-01-02",
        page: 2,
        limit: undefined,
      });
    });

    it("edit_team patches team fields", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["edit_team"].handler;
      await handler({ id: 7, name: "devs", permission: "write" });

      expect(client.patch).toHaveBeenCalledWith("/teams/7", {
        name: "devs",
        description: undefined,
        permission: "write",
        can_create_org_repo: undefined,
        includes_all_repositories: undefined,
        units: undefined,
        units_map: undefined,
      });
    });

    it("delete_team calls client.delete with team path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["delete_team"].handler;
      await handler({ id: 7 });

      expect(client.delete).toHaveBeenCalledWith("/teams/7");
    });

    it("list_team_members passes pagination", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["list_team_members"].handler;
      await handler({ id: 7, page: 1, limit: 20 });

      expect(client.get).toHaveBeenCalledWith("/teams/7/members", { page: 1, limit: 20 });
    });

    it("add_team_repo calls client.put with repo path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["add_team_repo"].handler;
      await handler({ id: 7, org: "my-org", repo: "my-repo" });

      expect(client.put).toHaveBeenCalledWith("/teams/7/repos/my-org/my-repo");
    });

    it("list_my_orgs calls client.get with /user/orgs", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["list_my_orgs"].handler;
      await handler({ page: 1, limit: 5 });

      expect(client.get).toHaveBeenCalledWith("/user/orgs", { page: 1, limit: 5 });
    });

    it("get_user_org_permissions builds the permissions path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["get_user_org_permissions"].handler;
      await handler({ username: "alice", org: "my-org" });

      expect(client.get).toHaveBeenCalledWith("/users/alice/orgs/my-org/permissions");
    });

    it("handler returns error response on failure", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Forbidden"));

      const tools = (server as any)._registeredTools;
      const handler = tools["get_org"].handler;
      const result = await handler({ org: "secret-org" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Forbidden");
    });
  });
});
