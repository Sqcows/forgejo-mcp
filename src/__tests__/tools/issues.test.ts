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
      "search_issues",
      "delete_issue",
      "list_repo_comments",
      "get_issue_comment",
      "list_issue_reactions",
      "add_issue_reaction",
      "remove_issue_reaction",
      "list_comment_reactions",
      "add_comment_reaction",
      "remove_comment_reaction",
      "list_issue_dependencies",
      "add_issue_dependency",
      "remove_issue_dependency",
      "list_issue_blocks",
      "add_issue_block",
      "remove_issue_block",
      "get_issue_labels",
      "replace_issue_labels",
      "clear_issue_labels",
      "pin_issue",
      "unpin_issue",
      "move_issue_pin",
      "list_pinned_issues",
      "check_new_pin_allowed",
      "set_issue_deadline",
      "list_issue_timeline",
      "list_issue_tracked_times",
      "add_issue_tracked_time",
      "reset_issue_tracked_times",
      "delete_issue_tracked_time",
      "list_repo_tracked_times",
      "start_issue_stopwatch",
      "stop_issue_stopwatch",
      "delete_issue_stopwatch",
      "list_issue_subscriptions",
      "check_issue_subscription",
      "subscribe_issue",
      "unsubscribe_issue",
      "list_issue_attachments",
      "get_issue_attachment",
      "edit_issue_attachment",
      "delete_issue_attachment",
      "list_comment_attachments",
      "get_comment_attachment",
      "edit_comment_attachment",
      "delete_comment_attachment",
    ];

    for (const toolName of expectedTools) {
      expect(tools[toolName], `Tool "${toolName}" should be registered`).toBeDefined();
    }
  });

  it("registers exactly 66 issue tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerIssueTools(server, client);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBe(66);
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

    it("search_issues passes filters as query params", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["search_issues"].handler;
      await handler({ q: "bug", state: "open", type: "issues" });

      expect(client.get).toHaveBeenCalledWith("/repos/issues/search", expect.objectContaining({ q: "bug", state: "open", type: "issues" }));
    });

    it("delete_issue calls client.delete", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["delete_issue"].handler;
      await handler({ owner: "user", repo: "repo", index: 5 });

      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo/issues/5");
    });

    it("list_repo_comments passes since and pagination", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["list_repo_comments"].handler;
      await handler({ owner: "user", repo: "repo", since: "2026-01-01T00:00:00Z", page: 2 });

      expect(client.get).toHaveBeenCalledWith("/repos/user/repo/issues/comments", { since: "2026-01-01T00:00:00Z", page: 2 });
    });

    it("add_issue_reaction posts the reaction content", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["add_issue_reaction"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, content: "+1" });

      expect(client.post).toHaveBeenCalledWith("/repos/user/repo/issues/5/reactions", { content: "+1" });
    });

    it("remove_comment_reaction sends the content as a DELETE body", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["remove_comment_reaction"].handler;
      await handler({ owner: "user", repo: "repo", id: 42, content: "heart" });

      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo/issues/comments/42/reactions", { content: "heart" });
    });

    it("add_issue_dependency maps target fields to IssueMeta", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["add_issue_dependency"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, target_owner: "other", target_repo: "lib", target_index: 9 });

      expect(client.post).toHaveBeenCalledWith("/repos/user/repo/issues/5/dependencies", { owner: "other", repo: "lib", index: 9 });
    });

    it("remove_issue_block sends IssueMeta as a DELETE body", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["remove_issue_block"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, target_owner: "other", target_repo: "lib", target_index: 9 });

      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo/issues/5/blocks", { owner: "other", repo: "lib", index: 9 });
    });

    it("replace_issue_labels calls client.put with labels", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["replace_issue_labels"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, labels: [1, "bug"] });

      expect(client.put).toHaveBeenCalledWith("/repos/user/repo/issues/5/labels", { labels: [1, "bug"] });
    });

    it("move_issue_pin patches the pin position", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["move_issue_pin"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, position: 2 });

      expect(client.patch).toHaveBeenCalledWith("/repos/user/repo/issues/5/pin/2");
    });

    it("set_issue_deadline can clear the deadline with null", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["set_issue_deadline"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, due_date: null });

      expect(client.post).toHaveBeenCalledWith("/repos/user/repo/issues/5/deadline", { due_date: null });
    });

    it("list_issue_timeline calls the timeline endpoint", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["list_issue_timeline"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, limit: 10 });

      expect(client.get).toHaveBeenCalledWith("/repos/user/repo/issues/5/timeline", { limit: 10 });
    });

    it("add_issue_tracked_time posts seconds", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["add_issue_tracked_time"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, time: 3600 });

      expect(client.post).toHaveBeenCalledWith("/repos/user/repo/issues/5/times", { time: 3600 });
    });

    it("delete_issue_tracked_time calls client.delete", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["delete_issue_tracked_time"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, id: 7 });

      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo/issues/5/times/7");
    });

    it("start_issue_stopwatch posts to the stopwatch endpoint", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["start_issue_stopwatch"].handler;
      await handler({ owner: "user", repo: "repo", index: 5 });

      expect(client.post).toHaveBeenCalledWith("/repos/user/repo/issues/5/stopwatch/start");
    });

    it("subscribe_issue calls client.put with the username", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["subscribe_issue"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, user: "alice" });

      expect(client.put).toHaveBeenCalledWith("/repos/user/repo/issues/5/subscriptions/alice");
    });

    it("edit_issue_attachment patches the attachment", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["edit_issue_attachment"].handler;
      await handler({ owner: "user", repo: "repo", index: 5, attachment_id: 3, name: "log.txt" });

      expect(client.patch).toHaveBeenCalledWith("/repos/user/repo/issues/5/assets/3", { name: "log.txt" });
    });

    it("delete_comment_attachment calls client.delete", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["delete_comment_attachment"].handler;
      await handler({ owner: "user", repo: "repo", id: 42, attachment_id: 3 });

      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo/issues/comments/42/assets/3");
    });
  });
});
