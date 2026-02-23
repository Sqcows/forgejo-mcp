import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient } from "../../client.js";
import { registerRepositoryTools } from "../../tools/repository.js";

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

describe("Repository Tools", () => {
  it("registers all repository tools without error", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    expect(() => registerRepositoryTools(server, client)).not.toThrow();
  });

  it("registers expected tool names", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerRepositoryTools(server, client);

    const tools = (server as any)._registeredTools;
    const expectedTools = [
      "search_repos",
      "get_repo",
      "create_repo",
      "create_org_repo",
      "delete_repo",
      "fork_repo",
      "list_branches",
      "get_branch",
      "create_branch",
      "delete_branch",
      "list_repo_commits",
      "get_file_contents",
      "create_file",
      "update_file",
      "delete_file",
      "list_releases",
      "create_release",
      "list_tags",
      "list_repo_topics",
      "update_repo_topics",
      "list_forks",
      "list_collaborators",
      "add_collaborator",
      "transfer_repo",
    ];

    for (const toolName of expectedTools) {
      expect(tools[toolName], `Tool "${toolName}" should be registered`).toBeDefined();
    }
  });

  it("registers exactly 24 repository tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerRepositoryTools(server, client);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBe(24);
  });

  describe("tool handler behavior", () => {
    let server: McpServer;
    let client: ReturnType<typeof createMockClient>;

    beforeEach(() => {
      server = new McpServer({ name: "test", version: "0.0.1" });
      client = createMockClient();
      registerRepositoryTools(server, client);
    });

    it("search_repos calls client.get with correct path", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });

      const tools = (server as any)._registeredTools;
      const handler = tools["search_repos"].handler;
      await handler({ q: "test", page: 1, limit: 10 });

      expect(client.get).toHaveBeenCalledWith("/repos/search", {
        q: "test",
        page: 1,
        limit: 10,
      });
    });

    it("create_repo sends correct body via client.post", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

      const tools = (server as any)._registeredTools;
      const handler = tools["create_repo"].handler;
      await handler({ name: "my-repo", description: "A test repo", private: true });

      expect(client.post).toHaveBeenCalledWith("/user/repos", {
        name: "my-repo",
        description: "A test repo",
        private: true,
        auto_init: undefined,
        default_branch: undefined,
      });
    });

    it("get_file_contents passes ref param", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ content: "aGVsbG8=" });

      const tools = (server as any)._registeredTools;
      const handler = tools["get_file_contents"].handler;
      await handler({ owner: "user", repo: "repo", filepath: "README.md", ref: "develop" });

      expect(client.get).toHaveBeenCalledWith(
        "/repos/user/repo/contents/README.md",
        { ref: "develop" }
      );
    });

    it("delete_file uses request method with body", async () => {
      (client.request as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const tools = (server as any)._registeredTools;
      const handler = tools["delete_file"].handler;
      await handler({
        owner: "user",
        repo: "repo",
        filepath: "old-file.txt",
        sha: "abc123",
        message: "Remove old file",
      });

      expect(client.request).toHaveBeenCalledWith(
        "DELETE",
        "/repos/user/repo/contents/old-file.txt",
        {
          body: {
            sha: "abc123",
            message: "Remove old file",
            branch: undefined,
          },
        }
      );
    });

    it("get_repo calls client.get with owner/repo path", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ full_name: "user/repo" });

      const tools = (server as any)._registeredTools;
      const handler = tools["get_repo"].handler;
      await handler({ owner: "myuser", repo: "myrepo" });

      expect(client.get).toHaveBeenCalledWith("/repos/myuser/myrepo");
    });

    it("delete_repo calls client.delete with correct path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["delete_repo"].handler;
      await handler({ owner: "user", repo: "repo" });

      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo");
    });

    it("fork_repo calls client.post with fork body", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 2 });

      const tools = (server as any)._registeredTools;
      const handler = tools["fork_repo"].handler;
      await handler({ owner: "upstream", repo: "project", organization: "myorg" });

      expect(client.post).toHaveBeenCalledWith("/repos/upstream/project/forks", {
        organization: "myorg",
        name: undefined,
      });
    });

    it("handler returns formatted response on success", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, name: "repo" });

      const tools = (server as any)._registeredTools;
      const handler = tools["get_repo"].handler;
      const result = await handler({ owner: "user", repo: "repo" });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain('"name": "repo"');
    });

    it("handler returns error response on failure", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

      const tools = (server as any)._registeredTools;
      const handler = tools["get_repo"].handler;
      const result = await handler({ owner: "user", repo: "repo" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error:");
      expect(result.content[0].text).toContain("Network error");
    });

    it("update_repo_topics returns valid response for 204 No Content", async () => {
      (client.put as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const tools = (server as any)._registeredTools;
      const handler = tools["update_repo_topics"].handler;
      const result = await handler({ owner: "user", repo: "repo", topics: ["mcp", "forgejo"] });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
      expect(typeof result.content[0].text).toBe("string");
      expect(result.content[0].text).toBe("Success");
    });
  });
});
