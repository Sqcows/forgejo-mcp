import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient } from "./client.js";
import type { ForgejoConfig } from "./config.js";
import { registerRepositoryTools } from "./tools/repository.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerPullRequestTools } from "./tools/pullrequests.js";
import { registerOrganizationTools } from "./tools/organizations.js";
import { registerUserTools } from "./tools/users.js";
import { registerAdminTools } from "./tools/admin.js";

export function createServer(config: ForgejoConfig): McpServer {
  const server = new McpServer(
    {
      name: "forgejo-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        logging: {},
      },
    }
  );

  const client = new ForgejoClient(config);

  registerRepositoryTools(server, client);
  registerIssueTools(server, client);
  registerPullRequestTools(server, client);
  registerOrganizationTools(server, client);
  registerUserTools(server, client);
  registerAdminTools(server, client);

  return server;
}
