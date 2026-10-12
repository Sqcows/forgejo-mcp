import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient } from "../../client.js";
import { registerActionsTools } from "../../tools/actions.js";

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

describe("Actions Tools", () => {
  it("registers all actions tools without error", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    expect(() => registerActionsTools(server, client)).not.toThrow();
  });

  it("registers expected tool names", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerActionsTools(server, client);

    const tools = (server as any)._registeredTools;
    const expectedTools = [
      "list_action_runs",
      "get_action_run",
      "delete_action_run",
      "cancel_action_run",
      "list_action_run_jobs",
      "get_action_job_logs",
      "list_action_run_artifacts",
      "list_action_artifacts",
      "get_action_artifact",
      "delete_action_artifact",
      "list_action_tasks",
      "dispatch_workflow",
      "list_repo_action_secrets",
      "set_repo_action_secret",
      "delete_repo_action_secret",
      "list_repo_action_variables",
      "get_repo_action_variable",
      "create_repo_action_variable",
      "update_repo_action_variable",
      "delete_repo_action_variable",
      "list_repo_runners",
      "get_repo_runner",
      "register_repo_runner",
      "delete_repo_runner",
      "list_repo_runner_jobs",
      "list_org_action_secrets",
      "set_org_action_secret",
      "delete_org_action_secret",
      "list_org_action_variables",
      "get_org_action_variable",
      "create_org_action_variable",
      "update_org_action_variable",
      "delete_org_action_variable",
      "list_org_runners",
      "get_org_runner",
      "register_org_runner",
      "delete_org_runner",
      "list_org_runner_jobs",
      "set_my_action_secret",
      "delete_my_action_secret",
      "list_my_action_variables",
      "get_my_action_variable",
      "create_my_action_variable",
      "update_my_action_variable",
      "delete_my_action_variable",
      "list_my_runners",
      "get_my_runner",
      "register_my_runner",
      "delete_my_runner",
      "list_my_runner_jobs",
      "admin_list_runners",
      "admin_get_runner",
      "admin_register_runner",
      "admin_delete_runner",
    ];

    for (const toolName of expectedTools) {
      expect(tools[toolName], `Tool "${toolName}" should be registered`).toBeDefined();
    }
  });

  it("registers exactly 54 actions tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerActionsTools(server, client);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBe(54);
  });

  describe("tool handler behavior", () => {
    let server: McpServer;
    let client: ReturnType<typeof createMockClient>;
    let tools: Record<string, { handler: (params: Record<string, unknown>) => Promise<any> }>;

    beforeEach(() => {
      server = new McpServer({ name: "test", version: "0.0.1" });
      client = createMockClient();
      registerActionsTools(server, client);
      tools = (server as any)._registeredTools;
    });

    it("list_action_runs joins array filters into comma-separated query params", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ workflow_runs: [] });

      await tools["list_action_runs"].handler({
        owner: "user",
        repo: "repo",
        event: ["push", "pull_request"],
        status: ["failure"],
        ref: "refs/heads/main",
        limit: 10,
      });

      expect(client.get).toHaveBeenCalledWith(
        "/repos/user/repo/actions/runs",
        expect.objectContaining({
          event: "push,pull_request",
          status: "failure",
          ref: "refs/heads/main",
          limit: 10,
        })
      );
    });

    it("list_action_runs omits array filters that are not set", async () => {
      await tools["list_action_runs"].handler({ owner: "user", repo: "repo", event: [] });

      const query = (client.get as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(query.event).toBeUndefined();
      expect(query.status).toBeUndefined();
    });

    it("get_action_run calls client.get with correct path", async () => {
      await tools["get_action_run"].handler({ owner: "user", repo: "repo", run_id: 42 });

      expect(client.get).toHaveBeenCalledWith("/repos/user/repo/actions/runs/42");
    });

    it("cancel_action_run posts to the cancel endpoint", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const result = await tools["cancel_action_run"].handler({ owner: "user", repo: "repo", run_id: 42 });

      expect(client.post).toHaveBeenCalledWith("/repos/user/repo/actions/runs/42/cancel");
      expect(result.content[0].text).toBe("Success");
    });

    it("delete_action_run calls client.delete with correct path", async () => {
      await tools["delete_action_run"].handler({ owner: "user", repo: "repo", run_id: 42 });

      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo/actions/runs/42");
    });

    it("get_action_job_logs returns the raw log text", async () => {
      (client.getRaw as ReturnType<typeof vi.fn>).mockResolvedValue("step 1\nstep 2");

      const result = await tools["get_action_job_logs"].handler({ owner: "user", repo: "repo", job_id: 7, attempt: 2 });

      expect(client.getRaw).toHaveBeenCalledWith("/repos/user/repo/actions/jobs/7/logs", { attempt: 2 });
      expect(result.content[0].text).toBe("step 1\nstep 2");
    });

    it("list_action_run_artifacts passes the name filter", async () => {
      await tools["list_action_run_artifacts"].handler({ owner: "user", repo: "repo", run_id: 42, name: "dist" });

      expect(client.get).toHaveBeenCalledWith(
        "/repos/user/repo/actions/runs/42/artifacts",
        expect.objectContaining({ name: "dist" })
      );
    });

    it("delete_action_artifact calls client.delete with correct path", async () => {
      await tools["delete_action_artifact"].handler({ owner: "user", repo: "repo", artifact_id: 9 });

      expect(client.delete).toHaveBeenCalledWith("/repos/user/repo/actions/artifacts/9");
    });

    it("list_action_tasks joins the status filter", async () => {
      await tools["list_action_tasks"].handler({ owner: "user", repo: "repo", status: ["running", "waiting"] });

      expect(client.get).toHaveBeenCalledWith(
        "/repos/user/repo/actions/tasks",
        expect.objectContaining({ status: "running,waiting" })
      );
    });

    it("dispatch_workflow sends ref and inputs", async () => {
      await tools["dispatch_workflow"].handler({
        owner: "user",
        repo: "repo",
        workflowfilename: "build.yml",
        ref: "main",
        inputs: { target: "prod" },
        return_run_info: true,
      });

      expect(client.post).toHaveBeenCalledWith(
        "/repos/user/repo/actions/workflows/build.yml/dispatches",
        { ref: "main", inputs: { target: "prod" }, return_run_info: true }
      );
    });

    it("set_repo_action_secret puts the secret data", async () => {
      await tools["set_repo_action_secret"].handler({
        owner: "user",
        repo: "repo",
        secretname: "DEPLOY_KEY",
        data: "s3cret",
      });

      expect(client.put).toHaveBeenCalledWith(
        "/repos/user/repo/actions/secrets/DEPLOY_KEY",
        { data: "s3cret" }
      );
    });

    it("delete_org_action_secret calls client.delete with correct path", async () => {
      await tools["delete_org_action_secret"].handler({ org: "myorg", secretname: "DEPLOY_KEY" });

      expect(client.delete).toHaveBeenCalledWith("/orgs/myorg/actions/secrets/DEPLOY_KEY");
    });

    it("set_my_action_secret uses the user scope", async () => {
      await tools["set_my_action_secret"].handler({ secretname: "TOKEN", data: "abc" });

      expect(client.put).toHaveBeenCalledWith("/user/actions/secrets/TOKEN", { data: "abc" });
    });

    it("create_repo_action_variable posts the value", async () => {
      await tools["create_repo_action_variable"].handler({
        owner: "user",
        repo: "repo",
        variablename: "NODE_VERSION",
        value: "22",
      });

      expect(client.post).toHaveBeenCalledWith(
        "/repos/user/repo/actions/variables/NODE_VERSION",
        { value: "22" }
      );
    });

    it("update_org_action_variable puts the value and new name", async () => {
      await tools["update_org_action_variable"].handler({
        org: "myorg",
        variablename: "NODE_VERSION",
        value: "24",
        name: "NODE",
      });

      expect(client.put).toHaveBeenCalledWith(
        "/orgs/myorg/actions/variables/NODE_VERSION",
        { value: "24", name: "NODE" }
      );
    });

    it("list_my_action_variables calls client.get with pagination", async () => {
      await tools["list_my_action_variables"].handler({ page: 2, limit: 5 });

      expect(client.get).toHaveBeenCalledWith("/user/actions/variables", { page: 2, limit: 5 });
    });

    it("delete_my_action_variable calls client.delete with correct path", async () => {
      await tools["delete_my_action_variable"].handler({ variablename: "NODE_VERSION" });

      expect(client.delete).toHaveBeenCalledWith("/user/actions/variables/NODE_VERSION");
    });

    it("list_repo_runners passes the visible flag", async () => {
      await tools["list_repo_runners"].handler({ owner: "user", repo: "repo", visible: true });

      expect(client.get).toHaveBeenCalledWith(
        "/repos/user/repo/actions/runners",
        expect.objectContaining({ visible: true })
      );
    });

    it("register_org_runner sends the runner options", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, uuid: "u", token: "t" });

      await tools["register_org_runner"].handler({ org: "myorg", name: "runner-1", ephemeral: true });

      expect(client.post).toHaveBeenCalledWith(
        "/orgs/myorg/actions/runners",
        expect.objectContaining({ name: "runner-1", ephemeral: true })
      );
    });

    it("list_org_runner_jobs passes the labels filter", async () => {
      await tools["list_org_runner_jobs"].handler({ org: "myorg", labels: "docker,linux" });

      expect(client.get).toHaveBeenCalledWith("/orgs/myorg/actions/runners/jobs", { labels: "docker,linux" });
    });

    it("get_my_runner calls client.get with correct path", async () => {
      await tools["get_my_runner"].handler({ runner_id: 3 });

      expect(client.get).toHaveBeenCalledWith("/user/actions/runners/3");
    });

    it("admin_list_runners uses the admin scope", async () => {
      await tools["admin_list_runners"].handler({});

      expect(client.get).toHaveBeenCalledWith("/admin/actions/runners", expect.any(Object));
    });

    it("admin_delete_runner calls client.delete with correct path", async () => {
      await tools["admin_delete_runner"].handler({ runner_id: 3 });

      expect(client.delete).toHaveBeenCalledWith("/admin/actions/runners/3");
    });

    it("returns a formatted error when the API call fails", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));

      const result = await tools["get_action_run"].handler({ owner: "user", repo: "repo", run_id: 1 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("boom");
    });
  });
});
