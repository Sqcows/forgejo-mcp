import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient } from "../../client.js";
import { registerUserTools } from "../../tools/users.js";

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

describe("User Tools", () => {
  it("registers all user tools without error", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    expect(() => registerUserTools(server, client)).not.toThrow();
  });

  it("registers expected tool names", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerUserTools(server, client);

    const tools = (server as any)._registeredTools;
    const expectedTools = [
      "get_authenticated_user",
      "get_user",
      "list_user_repos",
      "list_user_orgs",
      "search_users",
      "list_followers",
      "list_following",
      "list_user_starred",
      "list_my_starred",
      "star_repo",
      "unstar_repo",
      "list_my_notifications",
      "mark_notifications_read",
    ];

    for (const toolName of expectedTools) {
      expect(tools[toolName], `Tool "${toolName}" should be registered`).toBeDefined();
    }
  });

  it("registers exactly 13 user tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerUserTools(server, client);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBe(13);
  });

  describe("tool handler behavior", () => {
    let server: McpServer;
    let client: ReturnType<typeof createMockClient>;

    beforeEach(() => {
      server = new McpServer({ name: "test", version: "0.0.1" });
      client = createMockClient();
      registerUserTools(server, client);
    });

    it("get_authenticated_user calls client.get with /user", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ login: "me" });

      const tools = (server as any)._registeredTools;
      const handler = tools["get_authenticated_user"].handler;
      await handler({});

      expect(client.get).toHaveBeenCalledWith("/user");
    });

    it("search_users passes query params", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });

      const tools = (server as any)._registeredTools;
      const handler = tools["search_users"].handler;
      await handler({ q: "john", page: 1, limit: 5 });

      expect(client.get).toHaveBeenCalledWith("/users/search", {
        q: "john",
        page: 1,
        limit: 5,
      });
    });

    it("star_repo calls client.put with correct path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["star_repo"].handler;
      await handler({ owner: "user", repo: "cool-project" });

      expect(client.put).toHaveBeenCalledWith("/user/starred/user/cool-project");
    });

    it("unstar_repo calls client.delete with correct path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["unstar_repo"].handler;
      await handler({ owner: "user", repo: "old-project" });

      expect(client.delete).toHaveBeenCalledWith("/user/starred/user/old-project");
    });

    it("mark_notifications_read calls client.put with /notifications", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["mark_notifications_read"].handler;
      await handler({});

      expect(client.put).toHaveBeenCalledWith("/notifications");
    });

    it("handler returns error response on failure", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Unauthorized"));

      const tools = (server as any)._registeredTools;
      const handler = tools["get_user"].handler;
      const result = await handler({ username: "ghost" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unauthorized");
    });
  });
});
