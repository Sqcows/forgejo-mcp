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
      "edit_repo",
      "transfer_repo",
      "get_release",
      "get_latest_release",
      "get_release_by_tag",
      "edit_release",
      "delete_release",
      "delete_release_by_tag",
      "list_release_assets",
      "get_release_asset",
      "edit_release_asset",
      "delete_release_asset",
      "create_tag",
      "get_tag",
      "delete_tag",
      "get_commit",
      "get_commit_diff",
      "compare_commits",
      "get_combined_commit_status",
      "list_commit_statuses_by_ref",
      "list_commit_statuses",
      "create_commit_status",
      "list_repo_contents",
      "change_files",
      "get_raw_file",
      "get_editorconfig",
      "apply_diff_patch",
      "get_git_tree",
      "get_git_blob",
      "get_git_blobs",
      "list_git_refs",
      "get_git_ref",
      "get_annotated_tag",
      "get_commit_note",
      "set_commit_note",
      "delete_commit_note",
      "rename_branch",
      "list_repo_languages",
      "list_stargazers",
      "list_repo_watchers",
      "get_repo_subscription",
      "watch_repo",
      "unwatch_repo",
      "list_repo_assignees",
      "list_repo_reviewers",
      "list_repo_activity_feeds",
      "check_collaborator",
      "remove_collaborator",
      "get_collaborator_permission",
      "add_repo_topic",
      "delete_repo_topic",
      "search_topics",
      "get_repo_by_id",
      "list_issue_templates",
      "get_issue_config",
      "validate_issue_config",
    ];

    for (const toolName of expectedTools) {
      expect(tools[toolName], `Tool "${toolName}" should be registered`).toBeDefined();
    }
  });

  it("registers exactly 79 repository tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerRepositoryTools(server, client);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBe(79);
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
      expect(result.content[0].text).toBe('{"id":1,"name":"repo"}');
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

    it("edit_repo calls client.patch with correct path and body", async () => {
      (client.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

      const tools = (server as any)._registeredTools;
      const handler = tools["edit_repo"].handler;
      await handler({
        owner: "user",
        repo: "repo",
        has_pull_requests: true,
        has_issues: false,
        description: "Updated desc",
      });

      expect(client.patch).toHaveBeenCalledWith("/repos/user/repo", {
        has_pull_requests: true,
        has_issues: false,
        description: "Updated desc",
      });
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

    it("edit_release calls client.patch with release id and body", async () => {
      const handler = (server as any)._registeredTools["edit_release"].handler;
      await handler({ owner: "user", repo: "repo", id: 7, name: "v1.0.1", draft: false });

      expect(client.patch).toHaveBeenCalledWith(
        "/repos/user/repo/releases/7",
        expect.objectContaining({ name: "v1.0.1", draft: false })
      );
    });

    it("delete_release_asset calls client.delete with release and attachment ids", async () => {
      const handler = (server as any)._registeredTools["delete_release_asset"].handler;
      await handler({ owner: "user", repo: "repo", id: 7, attachment_id: 3 });

      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo/releases/7/assets/3");
    });

    it("create_tag sends tag body via client.post", async () => {
      const handler = (server as any)._registeredTools["create_tag"].handler;
      await handler({ owner: "user", repo: "repo", tag_name: "v1.0.0", target: "main", message: "First" });

      expect(client.post).toHaveBeenCalledWith("/repos/user/repo/tags", {
        tag_name: "v1.0.0",
        target: "main",
        message: "First",
      });
    });

    it("get_commit_diff uses getRaw with the diff type suffix", async () => {
      const handler = (server as any)._registeredTools["get_commit_diff"].handler;
      await handler({ owner: "user", repo: "repo", sha: "abc123", diff_type: "patch" });

      expect(client.getRaw).toHaveBeenCalledWith("/repos/user/repo/git/commits/abc123.patch");
    });

    it("compare_commits joins base and head with three dots", async () => {
      const handler = (server as any)._registeredTools["compare_commits"].handler;
      await handler({ owner: "user", repo: "repo", base: "main", head: "feature/x" });

      expect(client.get).toHaveBeenCalledWith("/repos/user/repo/compare/main...feature/x");
    });

    it("create_commit_status posts state and context", async () => {
      const handler = (server as any)._registeredTools["create_commit_status"].handler;
      await handler({ owner: "user", repo: "repo", sha: "abc123", state: "success", context: "ci/build" });

      expect(client.post).toHaveBeenCalledWith(
        "/repos/user/repo/statuses/abc123",
        expect.objectContaining({ state: "success", context: "ci/build" })
      );
    });

    it("change_files posts file operations to the contents endpoint", async () => {
      const handler = (server as any)._registeredTools["change_files"].handler;
      const files = [
        { operation: "create", path: "a.txt", content: "YQ==" },
        { operation: "delete", path: "b.txt", sha: "abc123" },
      ];
      await handler({ owner: "user", repo: "repo", files, message: "Batch", branch: "main" });

      expect(client.post).toHaveBeenCalledWith(
        "/repos/user/repo/contents",
        expect.objectContaining({ files, message: "Batch", branch: "main" })
      );
    });

    it("get_raw_file uses getRaw and passes ref", async () => {
      const handler = (server as any)._registeredTools["get_raw_file"].handler;
      await handler({ owner: "user", repo: "repo", filepath: "src/index.ts", ref: "dev" });

      expect(client.getRaw).toHaveBeenCalledWith("/repos/user/repo/raw/src/index.ts", { ref: "dev" });
    });

    it("get_git_tree passes recursive and paging params", async () => {
      const handler = (server as any)._registeredTools["get_git_tree"].handler;
      await handler({ owner: "user", repo: "repo", sha: "main", recursive: true, per_page: 100 });

      expect(client.get).toHaveBeenCalledWith("/repos/user/repo/git/trees/main", {
        recursive: true,
        page: undefined,
        per_page: 100,
      });
    });

    it("get_git_blobs joins SHAs into a comma-separated query param", async () => {
      const handler = (server as any)._registeredTools["get_git_blobs"].handler;
      await handler({ owner: "user", repo: "repo", shas: ["abc123", "def456"] });

      expect(client.get).toHaveBeenCalledWith("/repos/user/repo/git/blobs", { shas: "abc123,def456" });
    });

    it("set_commit_note posts the note message", async () => {
      const handler = (server as any)._registeredTools["set_commit_note"].handler;
      await handler({ owner: "user", repo: "repo", sha: "abc123", message: "Reviewed" });

      expect(client.post).toHaveBeenCalledWith("/repos/user/repo/git/notes/abc123", { message: "Reviewed" });
    });

    it("percent-encodes branch names and file paths instead of letting '#', '?' and '%' act as URL syntax", async () => {
      const tools = (server as any)._registeredTools;
      await tools["delete_branch"].handler({ owner: "user", repo: "repo", branch: "fix/issue#12" });
      await tools["get_file_contents"].handler({ owner: "user", repo: "repo", filepath: "./docs/what?/100%.md" });
      await tools["get_tag"].handler({ owner: "user", repo: "repo", tag: "%2e%2e/%2e%2e/admin" });

      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo/branches/fix/issue%2312");
      expect(client.get).toHaveBeenCalledWith("/repos/user/repo/contents/docs/what%3F/100%25.md", { ref: undefined });
      expect(client.get).toHaveBeenCalledWith("/repos/user/repo/tags/%252e%252e/%252e%252e/admin");
    });

    it("rejects '.' and '..' as owner or repository names", () => {
      const { inputSchema } = (server as any)._registeredTools["get_repo"];

      expect(inputSchema.safeParse({ owner: "..", repo: "repo" }).success).toBe(false);
      expect(inputSchema.safeParse({ owner: "user", repo: "." }).success).toBe(false);
      expect(inputSchema.safeParse({ owner: "user.name", repo: ".github" }).success).toBe(true);
    });

    it("rename_branch calls client.patch with the new name", async () => {
      const handler = (server as any)._registeredTools["rename_branch"].handler;
      await handler({ owner: "user", repo: "repo", branch: "old", name: "new" });

      expect(client.patch).toHaveBeenCalledWith("/repos/user/repo/branches/old", { name: "new" });
    });

    it("watch_repo and unwatch_repo use put and delete on the subscription", async () => {
      const tools = (server as any)._registeredTools;
      await tools["watch_repo"].handler({ owner: "user", repo: "repo" });
      await tools["unwatch_repo"].handler({ owner: "user", repo: "repo" });

      expect(client.put).toHaveBeenCalledWith("/repos/user/repo/subscription");
      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo/subscription");
    });

    it("remove_collaborator calls client.delete with the collaborator path", async () => {
      const handler = (server as any)._registeredTools["remove_collaborator"].handler;
      await handler({ owner: "user", repo: "repo", collaborator: "alice" });

      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo/collaborators/alice");
    });

    it("add_repo_topic calls client.put with the topic path", async () => {
      const handler = (server as any)._registeredTools["add_repo_topic"].handler;
      await handler({ owner: "user", repo: "repo", topic: "mcp" });

      expect(client.put).toHaveBeenCalledWith("/repos/user/repo/topics/mcp");
    });

    it("search_topics and get_repo_by_id call the top-level endpoints", async () => {
      const tools = (server as any)._registeredTools;
      await tools["search_topics"].handler({ q: "forgejo", limit: 5 });
      await tools["get_repo_by_id"].handler({ id: 42 });

      expect(client.get).toHaveBeenCalledWith("/topics/search", { q: "forgejo", page: undefined, limit: 5 });
      expect(client.get).toHaveBeenCalledWith("/repositories/42");
    });

    it("list_issue_templates calls client.get with the templates path", async () => {
      const handler = (server as any)._registeredTools["list_issue_templates"].handler;
      await handler({ owner: "user", repo: "repo" });

      expect(client.get).toHaveBeenCalledWith("/repos/user/repo/issue_templates");
    });
  });
});
