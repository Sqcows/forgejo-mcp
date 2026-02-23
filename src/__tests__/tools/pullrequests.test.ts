import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient } from "../../client.js";
import { registerPullRequestTools } from "../../tools/pullrequests.js";

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

describe("Pull Request Tools", () => {
  it("registers all pull request tools without error", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    expect(() => registerPullRequestTools(server, client)).not.toThrow();
  });

  it("registers expected tool names", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerPullRequestTools(server, client);

    const tools = (server as any)._registeredTools;
    const expectedTools = [
      "list_pull_requests",
      "get_pull_request",
      "create_pull_request",
      "edit_pull_request",
      "merge_pull_request",
      "list_pr_commits",
      "list_pr_files",
      "get_pr_diff",
      "list_pr_reviews",
      "create_pr_review",
      "request_pr_review",
      "update_pr_branch",
    ];

    for (const toolName of expectedTools) {
      expect(tools[toolName], `Tool "${toolName}" should be registered`).toBeDefined();
    }
  });

  it("registers exactly 12 pull request tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerPullRequestTools(server, client);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBe(12);
  });

  describe("tool handler behavior", () => {
    let server: McpServer;
    let client: ReturnType<typeof createMockClient>;

    beforeEach(() => {
      server = new McpServer({ name: "test", version: "0.0.1" });
      client = createMockClient();
      registerPullRequestTools(server, client);
    });

    it("list_pull_requests calls client.get with correct path", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const tools = (server as any)._registeredTools;
      const handler = tools["list_pull_requests"].handler;
      await handler({ owner: "user", repo: "repo", state: "open" });

      expect(client.get).toHaveBeenCalledWith(
        "/repos/user/repo/pulls",
        expect.objectContaining({ state: "open" })
      );
    });

    it("create_pull_request sends correct body", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue({ number: 1 });

      const tools = (server as any)._registeredTools;
      const handler = tools["create_pull_request"].handler;
      await handler({
        owner: "user",
        repo: "repo",
        title: "My PR",
        head: "feature",
        base: "main",
      });

      expect(client.post).toHaveBeenCalledWith(
        "/repos/user/repo/pulls",
        expect.objectContaining({
          title: "My PR",
          head: "feature",
          base: "main",
        })
      );
    });

    it("merge_pull_request sends correct merge method", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const tools = (server as any)._registeredTools;
      const handler = tools["merge_pull_request"].handler;
      await handler({
        owner: "user",
        repo: "repo",
        index: 1,
        merge_method: "squash",
        message: "Squash merge",
      });

      expect(client.post).toHaveBeenCalledWith(
        "/repos/user/repo/pulls/1/merge",
        expect.objectContaining({
          Do: "squash",
          MergeMessageField: "Squash merge",
        })
      );
    });

    it("get_pr_diff calls client.getRaw", async () => {
      (client.getRaw as ReturnType<typeof vi.fn>).mockResolvedValue("diff content");

      const tools = (server as any)._registeredTools;
      const handler = tools["get_pr_diff"].handler;
      await handler({ owner: "user", repo: "repo", index: 5 });

      expect(client.getRaw).toHaveBeenCalledWith("/repos/user/repo/pulls/5.diff");
    });

    it("handler returns error response on failure", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API error"));

      const tools = (server as any)._registeredTools;
      const handler = tools["get_pull_request"].handler;
      const result = await handler({ owner: "user", repo: "repo", index: 1 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("API error");
    });
  });
});
