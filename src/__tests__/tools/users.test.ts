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
      "check_new_notifications",
      "get_notification_thread",
      "mark_notification_thread_read",
      "list_repo_notifications",
      "mark_repo_notifications_read",
      "list_my_followers",
      "list_my_following",
      "check_my_following",
      "follow_user",
      "unfollow_user",
      "check_user_following",
      "list_my_emails",
      "add_my_emails",
      "delete_my_emails",
      "list_my_ssh_keys",
      "create_my_ssh_key",
      "get_my_ssh_key",
      "delete_my_ssh_key",
      "list_user_ssh_keys",
      "list_my_gpg_keys",
      "add_my_gpg_key",
      "get_my_gpg_key",
      "delete_my_gpg_key",
      "get_gpg_key_verification_token",
      "verify_my_gpg_key",
      "list_user_gpg_keys",
      "list_my_hooks",
      "create_my_hook",
      "get_my_hook",
      "edit_my_hook",
      "delete_my_hook",
      "list_my_blocked_users",
      "block_user",
      "unblock_user",
      "get_my_quota",
      "list_my_quota_artifacts",
      "list_my_quota_attachments",
      "list_my_quota_packages",
      "check_my_quota",
      "list_my_repos",
      "get_my_settings",
      "update_my_settings",
      "check_repo_starred",
      "list_my_stopwatches",
      "list_my_subscriptions",
      "list_user_subscriptions",
      "list_my_teams",
      "list_my_tracked_times",
      "list_user_activity_feeds",
      "get_user_heatmap",
    ];

    for (const toolName of expectedTools) {
      expect(tools[toolName], `Tool "${toolName}" should be registered`).toBeDefined();
    }
  });

  it("registers exactly 63 user tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerUserTools(server, client);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBe(63);
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

    it("check_new_notifications calls client.get with /notifications/new", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["check_new_notifications"].handler;
      await handler({});

      expect(client.get).toHaveBeenCalledWith("/notifications/new");
    });

    it("mark_notification_thread_read passes to-status as query param", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["mark_notification_thread_read"].handler;
      await handler({ id: 12, to_status: "pinned" });

      expect(client.patch).toHaveBeenCalledWith("/notifications/threads/12", undefined, { "to-status": "pinned" });
    });

    it("list_repo_notifications maps hyphenated query params", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["list_repo_notifications"].handler;
      await handler({ owner: "user", repo: "proj", all: true, status_type: "read", subject_type: "issue", page: 1 });

      expect(client.get).toHaveBeenCalledWith("/repos/user/proj/notifications", {
        all: true,
        "status-types": "read",
        "subject-type": "issue",
        since: undefined,
        before: undefined,
        page: 1,
        limit: undefined,
      });
    });

    it("mark_repo_notifications_read sends query params without a body", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["mark_repo_notifications_read"].handler;
      await handler({ owner: "user", repo: "proj", all: true });

      expect(client.put).toHaveBeenCalledWith("/repos/user/proj/notifications", undefined, {
        all: true,
        "status-types": undefined,
        "to-status": undefined,
        last_read_at: undefined,
      });
    });

    it("follow_user calls client.put with following path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["follow_user"].handler;
      await handler({ username: "alice" });

      expect(client.put).toHaveBeenCalledWith("/user/following/alice");
    });

    it("unfollow_user calls client.delete with following path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["unfollow_user"].handler;
      await handler({ username: "alice" });

      expect(client.delete).toHaveBeenCalledWith("/user/following/alice");
    });

    it("check_user_following builds the target path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["check_user_following"].handler;
      await handler({ username: "alice", target: "bob" });

      expect(client.get).toHaveBeenCalledWith("/users/alice/following/bob");
    });

    it("add_my_emails posts emails", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["add_my_emails"].handler;
      await handler({ emails: ["a@example.com"] });

      expect(client.post).toHaveBeenCalledWith("/user/emails", { emails: ["a@example.com"] });
    });

    it("delete_my_emails sends emails in the DELETE body", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["delete_my_emails"].handler;
      await handler({ emails: ["a@example.com"] });

      expect(client.delete).toHaveBeenCalledWith("/user/emails", { emails: ["a@example.com"] });
    });

    it("create_my_ssh_key posts key options", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["create_my_ssh_key"].handler;
      await handler({ title: "laptop", key: "ssh-ed25519 AAAA", read_only: true });

      expect(client.post).toHaveBeenCalledWith("/user/keys", { title: "laptop", key: "ssh-ed25519 AAAA", read_only: true });
    });

    it("list_user_ssh_keys passes fingerprint and pagination", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["list_user_ssh_keys"].handler;
      await handler({ username: "alice", fingerprint: "SHA256:abc", page: 1, limit: 10 });

      expect(client.get).toHaveBeenCalledWith("/users/alice/keys", { fingerprint: "SHA256:abc", page: 1, limit: 10 });
    });

    it("add_my_gpg_key posts the armored key", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["add_my_gpg_key"].handler;
      await handler({ armored_public_key: "-----BEGIN PGP PUBLIC KEY BLOCK-----" });

      expect(client.post).toHaveBeenCalledWith("/user/gpg_keys", {
        armored_public_key: "-----BEGIN PGP PUBLIC KEY BLOCK-----",
        armored_signature: undefined,
      });
    });

    it("delete_my_gpg_key calls client.delete with key path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["delete_my_gpg_key"].handler;
      await handler({ id: 3 });

      expect(client.delete).toHaveBeenCalledWith("/user/gpg_keys/3");
    });

    it("edit_my_hook patches hook options", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["edit_my_hook"].handler;
      await handler({ id: 5, active: false });

      expect(client.patch).toHaveBeenCalledWith("/user/hooks/5", {
        config: undefined,
        events: undefined,
        active: false,
        branch_filter: undefined,
        authorization_header: undefined,
      });
    });

    it("block_user calls client.put with block path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["block_user"].handler;
      await handler({ username: "spammer" });

      expect(client.put).toHaveBeenCalledWith("/user/block/spammer");
    });

    it("check_my_quota passes subject as query param", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["check_my_quota"].handler;
      await handler({ subject: "size:repos:all" });

      expect(client.get).toHaveBeenCalledWith("/user/quota/check", { subject: "size:repos:all" });
    });

    it("list_my_repos passes pagination and order_by", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["list_my_repos"].handler;
      await handler({ page: 1, limit: 10, order_by: "newest" });

      expect(client.get).toHaveBeenCalledWith("/user/repos", { page: 1, limit: 10, order_by: "newest" });
    });

    it("update_my_settings patches only the settings body", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["update_my_settings"].handler;
      await handler({ full_name: "Alice", hide_email: true });

      expect(client.patch).toHaveBeenCalledWith("/user/settings", expect.objectContaining({ full_name: "Alice", hide_email: true }));
    });

    it("check_repo_starred calls client.get with starred path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["check_repo_starred"].handler;
      await handler({ owner: "user", repo: "proj" });

      expect(client.get).toHaveBeenCalledWith("/user/starred/user/proj");
    });

    it("list_my_tracked_times passes time range", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["list_my_tracked_times"].handler;
      await handler({ since: "2026-01-01T00:00:00Z" });

      expect(client.get).toHaveBeenCalledWith("/user/times", {
        page: undefined,
        limit: undefined,
        since: "2026-01-01T00:00:00Z",
        before: undefined,
      });
    });

    it("list_user_activity_feeds maps only-performed-by", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["list_user_activity_feeds"].handler;
      await handler({ username: "alice", only_performed_by: true });

      expect(client.get).toHaveBeenCalledWith("/users/alice/activities/feeds", {
        "only-performed-by": true,
        date: undefined,
        page: undefined,
        limit: undefined,
      });
    });

    it("get_user_heatmap calls client.get with heatmap path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["get_user_heatmap"].handler;
      await handler({ username: "alice" });

      expect(client.get).toHaveBeenCalledWith("/users/alice/heatmap");
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
