import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient, ForgejoApiError } from "../../client.js";
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
      "get_pr_patch",
      "is_pr_merged",
      "cancel_pr_auto_merge",
      "cancel_pr_review_request",
      "get_pr_review",
      "submit_pr_review",
      "delete_pr_review",
      "list_pr_review_comments",
      "create_pr_review_comment",
      "get_pr_review_comment",
      "delete_pr_review_comment",
      "dismiss_pr_review",
      "undismiss_pr_review",
      "get_pr_by_base_head",
      "list_pinned_pull_requests",
      "get_commit_pull_request",
    ];

    for (const toolName of expectedTools) {
      expect(tools[toolName], `Tool "${toolName}" should be registered`).toBeDefined();
    }
  });

  it("registers exactly 28 pull request tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerPullRequestTools(server, client);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBe(28);
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

    it("merge_pull_request forwards auto-merge and branch cleanup options", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["merge_pull_request"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, merge_method: "fast-forward-only", merge_when_checks_succeed: true, delete_branch_after_merge: true, head_commit_id: "abc123" });

      expect(client.post).toHaveBeenCalledWith(
        "/repos/user/repo/pulls/5/merge",
        expect.objectContaining({
          Do: "fast-forward-only",
          merge_when_checks_succeed: true,
          delete_branch_after_merge: true,
          head_commit_id: "abc123",
        })
      );
    });

    it("update_pr_branch passes the update style as a query param", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["update_pr_branch"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, style: "rebase" });

      expect(client.post).toHaveBeenCalledWith("/repos/user/repo/pulls/5/update", undefined, { style: "rebase" });
    });

    it("get_pr_patch calls client.getRaw with the .patch path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["get_pr_patch"].handler;
      await handler({ owner: "user", repo: "repo", index: 5 });

      expect(client.getRaw).toHaveBeenCalledWith("/repos/user/repo/pulls/5.patch", { binary: undefined });
    });

    it("is_pr_merged reports merged on success and not merged on 404", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["is_pr_merged"].handler;

      (client.get as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const merged = await handler({ owner: "user", repo: "repo", index: 5 });
      expect(client.get).toHaveBeenCalledWith("/repos/user/repo/pulls/5/merge");
      expect(JSON.parse(merged.content[0].text)).toEqual({ merged: true });

      (client.get as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ForgejoApiError("Not Found", "https://example.com/api/v1/x", 404)
      );
      const notMerged = await handler({ owner: "user", repo: "repo", index: 5 });
      expect(notMerged.isError).toBeUndefined();
      expect(JSON.parse(notMerged.content[0].text)).toEqual({ merged: false });

      (client.get as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ForgejoApiError("Forbidden", "https://example.com/api/v1/x", 403)
      );
      const failed = await handler({ owner: "user", repo: "repo", index: 5 });
      expect(failed.isError).toBe(true);
    });

    it("cancel_pr_auto_merge calls client.delete on the merge endpoint", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["cancel_pr_auto_merge"].handler;
      await handler({ owner: "user", repo: "repo", index: 5 });

      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo/pulls/5/merge");
    });

    it("cancel_pr_review_request sends reviewers as a DELETE body", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["cancel_pr_review_request"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, reviewers: ["alice"] });

      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo/pulls/5/requested_reviewers", { reviewers: ["alice"] });
    });

    it("submit_pr_review posts the event to the review", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["submit_pr_review"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, id: 8, body: "LGTM", event: "APPROVED" });

      expect(client.post).toHaveBeenCalledWith("/repos/user/repo/pulls/5/reviews/8", { body: "LGTM", event: "APPROVED" });
    });

    it("create_pr_review_comment posts an inline comment", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["create_pr_review_comment"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, id: 8, path: "src/a.ts", body: "nit", new_position: 12 });

      expect(client.post).toHaveBeenCalledWith("/repos/user/repo/pulls/5/reviews/8/comments", { path: "src/a.ts", body: "nit", new_position: 12 });
    });

    it("delete_pr_review_comment calls client.delete", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["delete_pr_review_comment"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, id: 8, comment: 99 });

      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo/pulls/5/reviews/8/comments/99");
    });

    it("dismiss_pr_review posts the dismissal message", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["dismiss_pr_review"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, id: 8, message: "outdated" });

      expect(client.post).toHaveBeenCalledWith("/repos/user/repo/pulls/5/reviews/8/dismissals", { message: "outdated" });
    });

    it("get_pr_by_base_head URL-encodes branch names", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["get_pr_by_base_head"].handler;
      await handler({ owner: "user", repo: "repo", base: "main", head: "feature/foo" });

      expect(client.get).toHaveBeenCalledWith("/repos/user/repo/pulls/main/feature%2Ffoo");
    });

    it("get_commit_pull_request calls the commit pull endpoint", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["get_commit_pull_request"].handler;
      await handler({ owner: "user", repo: "repo", sha: "abc123" });

      expect(client.get).toHaveBeenCalledWith("/repos/user/repo/commits/abc123/pull");
    });
  });
});
