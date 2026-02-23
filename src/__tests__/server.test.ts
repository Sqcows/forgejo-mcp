import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "../server.js";

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
});
