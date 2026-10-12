import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "../server.js";
import { TOOL_AREAS } from "../config.js";

describe("createServer", () => {
  const dummyConfig = {
    baseUrl: "https://forgejo.example.com",
    token: "test-token",
  };

  it("returns an McpServer instance", () => {
    const server = createServer(dummyConfig);
    expect(server).toBeInstanceOf(McpServer);
  });

  it("does not throw during creation", () => {
    expect(() => createServer(dummyConfig)).not.toThrow();
  });

  it("registers tools on the server", () => {
    const server = createServer(dummyConfig);
    // Access internal registered tools to verify registration occurred.
    // The McpServer stores tools internally; we verify it has content.
    const registeredTools = (server as any)._registeredTools;
    expect(registeredTools).toBeDefined();
    expect(typeof registeredTools).toBe("object");
  });

  it("registers repository tools", () => {
    const server = createServer(dummyConfig);
    const tools = (server as any)._registeredTools;
    expect(tools["search_repos"]).toBeDefined();
    expect(tools["get_repo"]).toBeDefined();
    expect(tools["create_repo"]).toBeDefined();
    expect(tools["delete_repo"]).toBeDefined();
  });

  it("registers issue tools", () => {
    const server = createServer(dummyConfig);
    const tools = (server as any)._registeredTools;
    expect(tools["list_issues"]).toBeDefined();
    expect(tools["get_issue"]).toBeDefined();
    expect(tools["create_issue"]).toBeDefined();
  });

  it("registers pull request tools", () => {
    const server = createServer(dummyConfig);
    const tools = (server as any)._registeredTools;
    expect(tools["list_pull_requests"]).toBeDefined();
    expect(tools["get_pull_request"]).toBeDefined();
    expect(tools["create_pull_request"]).toBeDefined();
    expect(tools["merge_pull_request"]).toBeDefined();
  });

  it("registers organization tools", () => {
    const server = createServer(dummyConfig);
    const tools = (server as any)._registeredTools;
    expect(tools["list_orgs"]).toBeDefined();
    expect(tools["get_org"]).toBeDefined();
    expect(tools["create_org"]).toBeDefined();
  });

  it("registers user tools", () => {
    const server = createServer(dummyConfig);
    const tools = (server as any)._registeredTools;
    expect(tools["get_authenticated_user"]).toBeDefined();
    expect(tools["get_user"]).toBeDefined();
    expect(tools["search_users"]).toBeDefined();
  });

  it("registers admin tools", () => {
    const server = createServer(dummyConfig);
    const tools = (server as any)._registeredTools;
    expect(tools["admin_list_users"]).toBeDefined();
    expect(tools["admin_create_user"]).toBeDefined();
    expect(tools["get_server_version"]).toBeDefined();
  });

  it("registers repository settings, actions, and package tools", () => {
    const server = createServer(dummyConfig);
    const tools = (server as any)._registeredTools;
    expect(tools["list_repo_hooks"]).toBeDefined();
    expect(tools["list_branch_protections"]).toBeDefined();
    expect(tools["list_action_runs"]).toBeDefined();
    expect(tools["dispatch_workflow"]).toBeDefined();
    expect(tools["list_packages"]).toBeDefined();
  });

  it("keeps the server instructions short by summarizing areas instead of listing tools", () => {
    const server = createServer(dummyConfig);
    const instructions = (server.server as any)._instructions as string;
    expect(instructions.length).toBeLessThan(2500);
    expect(instructions).not.toContain("admin_list_quota_groups");
  });

  it("serves a compacted tool list", async () => {
    const server = createServer(dummyConfig);
    const handler = (server.server as any)._requestHandlers.get("tools/list");
    const { tools } = await handler({ method: "tools/list" }, {});
    const getRepo = tools.find((tool: any) => tool.name === "get_repo");

    expect(tools.length).toBe(Object.keys((server as any)._registeredTools).length);
    expect(getRepo.description).toBeTruthy();
    expect(getRepo.inputSchema).toEqual({
      type: "object",
      properties: { owner: { type: "string" }, repo: { type: "string" } },
      required: ["owner", "repo"],
    });
    expect(getRepo.execution).toBeUndefined();
  });

  it("skips disabled tool areas and omits them from the instructions", () => {
    const all = Object.keys((createServer(dummyConfig) as any)._registeredTools).length;
    const server = createServer({ ...dummyConfig, disabledAreas: ["admin", "actions"] });
    const tools = (server as any)._registeredTools;
    const instructions = (server.server as any)._instructions as string;

    expect(tools["admin_list_users"]).toBeUndefined();
    expect(tools["list_action_runs"]).toBeUndefined();
    expect(tools["get_repo"]).toBeDefined();
    expect(Object.keys(tools).length).toBeLessThan(all);
    expect(instructions).not.toContain("**Admin**");
    expect(instructions).not.toContain("**Actions**");
    expect(instructions).toContain("**Repository**");
  });

  it("registers no tools when every area is disabled", () => {
    const server = createServer({ ...dummyConfig, disabledAreas: [...TOOL_AREAS] });
    expect(Object.keys((server as any)._registeredTools ?? {}).length).toBe(0);
  });

  it("provides server instructions", () => {
    const server = createServer(dummyConfig);
    const instructions = (server.server as any)._instructions;
    expect(instructions).toBeDefined();
    expect(typeof instructions).toBe("string");
    expect(instructions).toContain("Forgejo");
    expect(instructions).toContain("Repository");
    expect(instructions).toContain("Issues");
    expect(instructions).toContain("Pull Requests");
    expect(instructions).toContain("Organizations");
    expect(instructions).toContain("Users");
    expect(instructions).toContain("Admin");
    expect(instructions).toContain("Actions");
    expect(instructions).toContain("Packages");
  });
});
