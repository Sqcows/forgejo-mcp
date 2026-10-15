import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer, LOAD_TOOL_AREA } from "../server.js";
import { TOOL_AREAS, type ForgejoConfig } from "../config.js";

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

describe("lazy mode", () => {
  const lazyConfig: ForgejoConfig = {
    baseUrl: "https://forgejo.example.com",
    token: "test-token",
    lazy: true,
  };

  // Through the server's own request handlers, so the compacted (and cached)
  // tools/list and the SDK's enabled checks and input validation all apply
  async function listToolNames(server: McpServer): Promise<string[]> {
    const handler = (server.server as any)._requestHandlers.get("tools/list");
    const { tools } = await handler({ method: "tools/list" }, {});
    return tools.map((tool: any) => tool.name);
  }

  function callTool(server: McpServer, name: string, args: unknown, sendNotification = vi.fn()) {
    const handler = (server.server as any)._requestHandlers.get("tools/call");
    return handler(
      { method: "tools/call", params: { name, arguments: args } },
      { signal: new AbortController().signal, requestId: 1, sendNotification, sendRequest: vi.fn() }
    );
  }

  it("is off by default", async () => {
    const names = await listToolNames(createServer({ ...lazyConfig, lazy: undefined }));
    expect(names).not.toContain(LOAD_TOOL_AREA);
    expect(names).toContain("get_repo");
  });

  it("lists only the loader at first, describing every enabled area", async () => {
    const server = createServer(lazyConfig);
    const handler = (server.server as any)._requestHandlers.get("tools/list");
    const { tools } = await handler({ method: "tools/list" }, {});

    expect(tools.map((tool: any) => tool.name)).toEqual([LOAD_TOOL_AREA]);
    expect(tools[0].inputSchema.properties.areas.items.enum).toEqual([...TOOL_AREAS]);
    expect(tools[0].description).toContain("repo-settings (webhooks");
    expect(tools[0].description).toContain("admin (user administration");
  });

  it("tells the model to load areas first instead of listing categories", () => {
    const instructions = (createServer(lazyConfig).server as any)._instructions as string;
    expect(instructions).toContain(`only \`${LOAD_TOOL_AREA}\` is available`);
    expect(instructions).not.toContain("## Tool categories");
  });

  it("offers only the areas that are not disabled", async () => {
    const server = createServer({ ...lazyConfig, disabledAreas: ["admin", "actions"] });
    const handler = (server.server as any)._requestHandlers.get("tools/list");
    const { tools } = await handler({ method: "tools/list" }, {});
    const offered = tools[0].inputSchema.properties.areas.items.enum;

    expect(offered).not.toContain("admin");
    expect(offered).not.toContain("actions");
    expect(offered).toContain("repository");
    expect(tools[0].description).not.toContain("admin (");

    const result = await callTool(server, LOAD_TOOL_AREA, { areas: ["admin"] });
    expect(result.isError).toBe(true);
    expect((server as any)._registeredTools["admin_list_users"]).toBeUndefined();
  });

  it("loads the requested areas and tells the client once", async () => {
    const server = createServer(lazyConfig);
    const sendNotification = vi.fn();
    const result = await callTool(server, LOAD_TOOL_AREA, { areas: ["packages", "pull-requests"] }, sendNotification);

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("Loaded 34 tools for packages, pull-requests:");
    expect(result.content[0].text).toContain("list_packages");
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification).toHaveBeenCalledWith({ method: "notifications/tools/list_changed" });

    const names = await listToolNames(server);
    expect(names).toHaveLength(35);
    expect(names).toContain(LOAD_TOOL_AREA);
    expect(names).toContain("list_packages");
    expect(names).toContain("merge_pull_request");
    expect(names).not.toContain("get_repo");
  });

  it("does not notify again for areas that are already loaded", async () => {
    const server = createServer(lazyConfig);
    await callTool(server, LOAD_TOOL_AREA, { areas: ["packages"] });

    const sendNotification = vi.fn();
    const again = await callTool(server, LOAD_TOOL_AREA, { areas: ["packages", "packages"] }, sendNotification);
    expect(again.content[0].text).toContain("Already loaded");
    expect(sendNotification).not.toHaveBeenCalled();

    // A mix loads only the new area
    const mixed = await callTool(server, LOAD_TOOL_AREA, { areas: ["packages", "pull-requests"] }, sendNotification);
    expect(mixed.content[0].text).toContain("Loaded 28 tools for pull-requests:");
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("refuses to run tools from areas that are not loaded", async () => {
    const server = createServer(lazyConfig);
    const before = await callTool(server, "get_repo", { owner: "o", repo: "r" });
    expect(before.isError).toBe(true);
    expect(before.content[0].text).toContain("disabled");
  });

  it("rejects unknown and empty area lists", async () => {
    const server = createServer(lazyConfig);
    expect((await callTool(server, LOAD_TOOL_AREA, { areas: ["nope"] })).isError).toBe(true);
    expect((await callTool(server, LOAD_TOOL_AREA, { areas: [] })).isError).toBe(true);
    expect(await listToolNames(server)).toEqual([LOAD_TOOL_AREA]);
  });

  it("keeps each server's loaded areas to itself", async () => {
    // In HTTP mode every session has its own server, and the cached tool list
    // must not carry one session's loaded areas into another
    const first = createServer(lazyConfig);
    const second = createServer(lazyConfig);
    expect(await listToolNames(first)).toEqual([LOAD_TOOL_AREA]);

    await callTool(first, LOAD_TOOL_AREA, { areas: ["issues"] });
    expect((await listToolNames(first)).length).toBe(67);
    expect(await listToolNames(second)).toEqual([LOAD_TOOL_AREA]);
    expect(await listToolNames(createServer({ ...lazyConfig, lazy: false }))).not.toContain(LOAD_TOOL_AREA);
  });

  it("registers no loader when every area is disabled", async () => {
    const server = createServer({ ...lazyConfig, disabledAreas: [...TOOL_AREAS] });
    expect(Object.keys((server as any)._registeredTools)).toEqual([]);
    expect((server.server as any)._instructions).not.toContain(LOAD_TOOL_AREA);
  });
});
