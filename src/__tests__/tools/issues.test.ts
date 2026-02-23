import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient } from "../../client.js";
import { registerIssueTools } from "../../tools/issues.js";

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

describe("Issue Tools", () => {
  it("registers all issue tools without error", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    expect(() => registerIssueTools(server, client)).not.toThrow();
  });

  it("registers expected tool names", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerIssueTools(server, client);

    const tools = (server as any)._registeredTools;
    const expectedTools = [
      "list_issues",
      "get_issue",
      "create_issue",
      "edit_issue",
      "list_issue_comments",
      "create_issue_comment",
      "edit_issue_comment",
      "delete_issue_comment",
      "list_labels",
      "get_label",
      "create_label",
      "edit_label",
      "delete_label",
      "add_issue_labels",
      "remove_issue_label",
      "list_milestones",
      "get_milestone",
      "create_milestone",
      "edit_milestone",
      "delete_milestone",
    ];

    for (const toolName of expectedTools) {
      expect(tools[toolName], `Tool "${toolName}" should be registered`).toBeDefined();
    }
  });

  it("registers exactly 20 issue tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerIssueTools(server, client);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBe(20);
  });

  describe("tool handler behavior", () => {
    let server: McpServer;
    let client: ReturnType<typeof createMockClient>;

    beforeEach(() => {
      server = new McpServer({ name: "test", version: "0.0.1" });
      client = createMockClient();
      registerIssueTools(server, client);
    });

    it("list_issues calls client.get with correct path and query", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const tools = (server as any)._registeredTools;
      const handler = tools["list_issues"].handler;
      await handler({ owner: "user", repo: "repo", state: "open" });

      expect(client.get).toHaveBeenCalledWith(
        "/repos/user/repo/issues",
        expect.objectContaining({ state: "open" })
      );
    });

    it("create_issue sends correct body", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

      const tools = (server as any)._registeredTools;
      const handler = tools["create_issue"].handler;
      await handler({ owner: "user", repo: "repo", title: "Bug report", body: "Details here" });

      expect(client.post).toHaveBeenCalledWith(
        "/repos/user/repo/issues",
        expect.objectContaining({ title: "Bug report", body: "Details here" })
      );
    });

    it("edit_issue calls client.patch with correct path", async () => {
      (client.patch as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const tools = (server as any)._registeredTools;
      const handler = tools["edit_issue"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, title: "Updated title" });

      expect(client.patch).toHaveBeenCalledWith(
        "/repos/user/repo/issues/5",
        expect.objectContaining({ title: "Updated title" })
      );
    });

    it("delete_issue_comment calls client.delete", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["delete_issue_comment"].handler;
      await handler({ owner: "user", repo: "repo", id: 42 });

      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo/issues/comments/42");
    });

    it("handler returns formatted error on failure", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Not found"));

      const tools = (server as any)._registeredTools;
      const handler = tools["get_issue"].handler;
      const result = await handler({ owner: "user", repo: "repo", index: 999 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Not found");
    });
  });
});
