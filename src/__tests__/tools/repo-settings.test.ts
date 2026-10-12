import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient } from "../../client.js";
import { registerRepoSettingsTools } from "../../tools/repo-settings.js";

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

describe("Repo Settings Tools", () => {
  it("registers all repo settings tools without error", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    expect(() => registerRepoSettingsTools(server, client)).not.toThrow();
  });

  it("registers expected tool names", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerRepoSettingsTools(server, client);

    const tools = (server as any)._registeredTools;
    const expectedTools = [
      "list_repo_hooks",
      "get_repo_hook",
      "create_repo_hook",
      "edit_repo_hook",
      "delete_repo_hook",
      "test_repo_hook",
      "list_branch_protections",
      "get_branch_protection",
      "create_branch_protection",
      "edit_branch_protection",
      "delete_branch_protection",
      "list_tag_protections",
      "get_tag_protection",
      "create_tag_protection",
      "edit_tag_protection",
      "delete_tag_protection",
      "list_deploy_keys",
      "get_deploy_key",
      "add_deploy_key",
      "delete_deploy_key",
      "list_push_mirrors",
      "get_push_mirror",
      "add_push_mirror",
      "delete_push_mirror",
      "sync_push_mirrors",
      "sync_mirror",
      "convert_mirror_repo",
      "list_repo_teams",
      "check_repo_team",
      "add_repo_team",
      "remove_repo_team",
      "list_wiki_pages",
      "get_wiki_page",
      "create_wiki_page",
      "edit_wiki_page",
      "delete_wiki_page",
      "list_wiki_page_revisions",
      "migrate_repo",
      "generate_repo_from_template",
      "get_sync_fork_info",
      "sync_fork",
      "accept_repo_transfer",
      "reject_repo_transfer",
      "list_repo_flags",
      "replace_repo_flags",
      "clear_repo_flags",
      "check_repo_flag",
      "add_repo_flag",
      "remove_repo_flag",
      "get_repo_signing_key",
    ];

    for (const toolName of expectedTools) {
      expect(tools[toolName], `Tool "${toolName}" should be registered`).toBeDefined();
    }
  });

  it("registers exactly 50 repo settings tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerRepoSettingsTools(server, client);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBe(50);
  });

  describe("tool handler behavior", () => {
    let server: McpServer;
    let client: ForgejoClient;
    let tools: any;

    beforeEach(() => {
      server = new McpServer({ name: "test", version: "0.0.1" });
      client = createMockClient();
      registerRepoSettingsTools(server, client);
      tools = (server as any)._registeredTools;
    });

    it("create_repo_hook posts the hook definition", async () => {
      await tools["create_repo_hook"].handler({
        owner: "o",
        repo: "r",
        type: "forgejo",
        config: { url: "https://example.com/hook", content_type: "json" },
        events: ["push"],
        active: true,
      });
      expect(client.post).toHaveBeenCalledWith("/repos/o/r/hooks", {
        type: "forgejo",
        config: { url: "https://example.com/hook", content_type: "json" },
        events: ["push"],
        branch_filter: undefined,
        authorization_header: undefined,
        active: true,
      });
    });

    it("test_repo_hook passes ref as a query param", async () => {
      await tools["test_repo_hook"].handler({ owner: "o", repo: "r", id: 3, ref: "main" });
      expect(client.post).toHaveBeenCalledWith("/repos/o/r/hooks/3/tests", undefined, { ref: "main" });
    });

    it("create_branch_protection sends only rule settings in the body", async () => {
      await tools["create_branch_protection"].handler({
        owner: "o",
        repo: "r",
        rule_name: "main",
        required_approvals: 2,
        enable_push: false,
      });
      expect(client.post).toHaveBeenCalledWith("/repos/o/r/branch_protections", {
        rule_name: "main",
        required_approvals: 2,
        enable_push: false,
      });
    });

    it("edit_branch_protection URL-encodes the rule name", async () => {
      await tools["edit_branch_protection"].handler({
        owner: "o",
        repo: "r",
        name: "release/*",
        require_signed_commits: true,
      });
      expect(client.patch).toHaveBeenCalledWith("/repos/o/r/branch_protections/release%2F*", {
        require_signed_commits: true,
      });
    });

    it("edit_tag_protection patches by ID", async () => {
      await tools["edit_tag_protection"].handler({ owner: "o", repo: "r", id: 7, name_pattern: "v*" });
      expect(client.patch).toHaveBeenCalledWith("/repos/o/r/tag_protections/7", {
        name_pattern: "v*",
        whitelist_usernames: undefined,
        whitelist_teams: undefined,
      });
    });

    it("add_deploy_key posts the key", async () => {
      await tools["add_deploy_key"].handler({ owner: "o", repo: "r", title: "ci", key: "ssh-ed25519 AAAA", read_only: true });
      expect(client.post).toHaveBeenCalledWith("/repos/o/r/keys", {
        title: "ci",
        key: "ssh-ed25519 AAAA",
        read_only: true,
      });
    });

    it("list_deploy_keys forwards filters and pagination", async () => {
      await tools["list_deploy_keys"].handler({ owner: "o", repo: "r", fingerprint: "SHA256:x", page: 2, limit: 10 });
      expect(client.get).toHaveBeenCalledWith("/repos/o/r/keys", {
        key_id: undefined,
        fingerprint: "SHA256:x",
        page: 2,
        limit: 10,
      });
    });

    it("delete_push_mirror deletes by remote name", async () => {
      await tools["delete_push_mirror"].handler({ owner: "o", repo: "r", name: "remote_mirror_abc" });
      expect(client.delete).toHaveBeenCalledWith("/repos/o/r/push_mirrors/remote_mirror_abc");
    });

    it("sync_push_mirrors and sync_mirror hit the sync endpoints", async () => {
      await tools["sync_push_mirrors"].handler({ owner: "o", repo: "r" });
      expect(client.post).toHaveBeenCalledWith("/repos/o/r/push_mirrors-sync");
      await tools["sync_mirror"].handler({ owner: "o", repo: "r" });
      expect(client.post).toHaveBeenCalledWith("/repos/o/r/mirror-sync");
    });

    it("add_repo_team puts the team", async () => {
      await tools["add_repo_team"].handler({ owner: "o", repo: "r", team: "devs" });
      expect(client.put).toHaveBeenCalledWith("/repos/o/r/teams/devs");
    });

    it("get_wiki_page URL-encodes the page name", async () => {
      await tools["get_wiki_page"].handler({ owner: "o", repo: "r", page_name: "Getting Started" });
      expect(client.get).toHaveBeenCalledWith("/repos/o/r/wiki/page/Getting%20Started");
    });

    it("create_wiki_page posts to wiki/new", async () => {
      await tools["create_wiki_page"].handler({ owner: "o", repo: "r", title: "Home", content_base64: "SGk=" });
      expect(client.post).toHaveBeenCalledWith("/repos/o/r/wiki/new", {
        title: "Home",
        content_base64: "SGk=",
        message: undefined,
      });
    });

    it("migrate_repo posts to /repos/migrate", async () => {
      await tools["migrate_repo"].handler({
        clone_addr: "https://github.com/a/b.git",
        repo_name: "b",
        repo_owner: "me",
        mirror: true,
      });
      expect(client.post).toHaveBeenCalledWith(
        "/repos/migrate",
        expect.objectContaining({
          clone_addr: "https://github.com/a/b.git",
          repo_name: "b",
          repo_owner: "me",
          mirror: true,
        })
      );
    });

    it("generate_repo_from_template posts to the template's generate endpoint", async () => {
      await tools["generate_repo_from_template"].handler({
        template_owner: "t",
        template_repo: "tpl",
        owner: "me",
        name: "new",
        git_content: true,
      });
      expect(client.post).toHaveBeenCalledWith(
        "/repos/t/tpl/generate",
        expect.objectContaining({ owner: "me", name: "new", git_content: true })
      );
    });

    it("sync_fork targets the default branch or a named branch", async () => {
      await tools["sync_fork"].handler({ owner: "o", repo: "r" });
      expect(client.post).toHaveBeenCalledWith("/repos/o/r/sync_fork");
      await tools["get_sync_fork_info"].handler({ owner: "o", repo: "r", branch: "feature/x" });
      expect(client.get).toHaveBeenCalledWith("/repos/o/r/sync_fork/feature/x");
    });

    it("accept_repo_transfer posts to transfer/accept", async () => {
      await tools["accept_repo_transfer"].handler({ owner: "o", repo: "r" });
      expect(client.post).toHaveBeenCalledWith("/repos/o/r/transfer/accept");
    });

    it("replace_repo_flags puts the flag list", async () => {
      await tools["replace_repo_flags"].handler({ owner: "o", repo: "r", flags: ["a", "b"] });
      expect(client.put).toHaveBeenCalledWith("/repos/o/r/flags", { flags: ["a", "b"] });
    });

    it("get_repo_signing_key returns the raw key", async () => {
      (client.getRaw as any).mockResolvedValue("-----BEGIN PGP PUBLIC KEY BLOCK-----");
      const result = await tools["get_repo_signing_key"].handler({ owner: "o", repo: "r" });
      expect(client.getRaw).toHaveBeenCalledWith("/repos/o/r/signing-key.gpg");
      expect(result.content[0].text).toContain("BEGIN PGP");
    });

    it("returns a formatted error when the client throws", async () => {
      (client.get as any).mockRejectedValue(new Error("boom"));
      const result = await tools["list_repo_hooks"].handler({ owner: "o", repo: "r" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("boom");
    });
  });
});
