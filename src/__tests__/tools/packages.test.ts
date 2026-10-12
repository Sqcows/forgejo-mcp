import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient } from "../../client.js";
import { registerPackageTools } from "../../tools/packages.js";

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

describe("Package Tools", () => {
  it("registers all package tools without error", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    expect(() => registerPackageTools(server, client)).not.toThrow();
  });

  it("registers expected tool names", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerPackageTools(server, client);

    const tools = (server as any)._registeredTools;
    const expectedTools = [
      "list_packages",
      "get_package",
      "delete_package",
      "list_package_files",
      "link_package",
      "unlink_package",
    ];

    for (const toolName of expectedTools) {
      expect(tools[toolName], `Tool "${toolName}" should be registered`).toBeDefined();
    }
  });

  it("registers exactly 6 package tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const client = createMockClient();
    registerPackageTools(server, client);

    const tools = (server as any)._registeredTools;
    expect(Object.keys(tools).length).toBe(6);
  });

  describe("tool handler behavior", () => {
    let server: McpServer;
    let client: ReturnType<typeof createMockClient>;

    beforeEach(() => {
      server = new McpServer({ name: "test", version: "0.0.1" });
      client = createMockClient();
      registerPackageTools(server, client);
    });

    it("list_packages calls client.get with filters", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const tools = (server as any)._registeredTools;
      const handler = tools["list_packages"].handler;
      await handler({ owner: "org1", type: "npm", q: "lib", page: 1, limit: 10 });

      expect(client.get).toHaveBeenCalledWith("/packages/org1", {
        type: "npm",
        q: "lib",
        page: 1,
        limit: 10,
      });
    });

    it("get_package URL-encodes the package name and version", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["get_package"].handler;
      await handler({ owner: "org1", type: "npm", name: "@scope/pkg", version: "1.0.0+build" });

      expect(client.get).toHaveBeenCalledWith("/packages/org1/npm/%40scope%2Fpkg/1.0.0%2Bbuild");
    });

    it("delete_package calls client.delete", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["delete_package"].handler;
      const result = await handler({ owner: "org1", type: "generic", name: "tool", version: "2.1.0" });

      expect(client.delete).toHaveBeenCalledWith("/packages/org1/generic/tool/2.1.0");
      expect(result.content[0].text).toBe("Package deleted successfully");
    });

    it("list_package_files calls client.get with the files path", async () => {
      const tools = (server as any)._registeredTools;
      const handler = tools["list_package_files"].handler;
      await handler({ owner: "org1", type: "generic", name: "tool", version: "2.1.0" });

      expect(client.get).toHaveBeenCalledWith("/packages/org1/generic/tool/2.1.0/files");
    });

    it("link_package posts to the link path", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const tools = (server as any)._registeredTools;
      const handler = tools["link_package"].handler;
      await handler({ owner: "org1", type: "generic", name: "tool", repo_name: "myrepo" });

      expect(client.post).toHaveBeenCalledWith("/packages/org1/generic/tool/-/link/myrepo");
    });

    it("unlink_package posts to the unlink path", async () => {
      (client.post as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const tools = (server as any)._registeredTools;
      const handler = tools["unlink_package"].handler;
      await handler({ owner: "org1", type: "generic", name: "tool" });

      expect(client.post).toHaveBeenCalledWith("/packages/org1/generic/tool/-/unlink");
    });

    it("handler returns error response on failure", async () => {
      (client.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Not found"));

      const tools = (server as any)._registeredTools;
      const handler = tools["list_packages"].handler;
      const result = await handler({ owner: "org1" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Not found");
    });
  });
});
