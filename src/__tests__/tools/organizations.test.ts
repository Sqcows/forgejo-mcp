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
    ];

    for (const toolName of expectedTools) {
      expect(tools[toolName], `Tool "${toolName}" should be registered`).toBeDefined();
    }
  });

  it("registers exactly 14 organization tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerOrganizationTools(server, client);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBe(14);
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
