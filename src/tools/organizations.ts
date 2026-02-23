import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient } from "../client.js";
import { formatResponse, formatError } from "./helpers.js";
import { zOwner, zPage, zLimit, zId, zTitle, zBody, zVisibility, zPermission } from "../validation.js";

export function registerOrganizationTools(server: McpServer, client: ForgejoClient): void {
  // 1. list_orgs
  server.tool(
    "list_orgs",
    "List all organizations on the Forgejo instance",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/orgs", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 2. get_org
  server.tool(
    "get_org",
    "Get details of an organization",
    {
      org: zOwner.describe("Name of the organization"),
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 3. create_org
  server.tool(
    "create_org",
    "Create a new organization",
    {
      username: zOwner.describe("Username for the organization"),
      full_name: zTitle.optional().describe("Full display name of the organization"),
      description: zBody.optional().describe("Description of the organization"),
      visibility: zVisibility.describe("Visibility of the organization: public, limited, or private"),
    },
    async (params) => {
      try {
        const data = await client.post("/orgs", {
          username: params.username,
          full_name: params.full_name,
          description: params.description,
          visibility: params.visibility,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 4. edit_org
  server.tool(
    "edit_org",
    "Edit an organization's properties",
    {
      org: zOwner.describe("Name of the organization to edit"),
      full_name: zTitle.optional().describe("Full display name of the organization"),
      description: zBody.optional().describe("Description of the organization"),
      visibility: zVisibility.describe("Visibility of the organization: public, limited, or private"),
    },
    async (params) => {
      try {
        const data = await client.patch(`/orgs/${params.org}`, {
          full_name: params.full_name,
          description: params.description,
          visibility: params.visibility,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 5. delete_org
  server.tool(
    "delete_org",
    "Delete an organization",
    {
      org: zOwner.describe("Name of the organization to delete"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/orgs/${params.org}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 6. list_org_repos
  server.tool(
    "list_org_repos",
    "List repositories belonging to an organization",
    {
      org: zOwner.describe("Name of the organization"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/repos`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 7. list_org_members
  server.tool(
    "list_org_members",
    "List members of an organization",
    {
      org: zOwner.describe("Name of the organization"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/members`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 8. list_org_teams
  server.tool(
    "list_org_teams",
    "List teams in an organization",
    {
      org: zOwner.describe("Name of the organization"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/teams`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 9. get_team
  server.tool(
    "get_team",
    "Get a team by its ID",
    {
      id: zId.describe("ID of the team"),
    },
    async (params) => {
      try {
        const data = await client.get(`/teams/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 10. create_team
  server.tool(
    "create_team",
    "Create a new team in an organization",
    {
      org: zOwner.describe("Name of the organization"),
      name: zTitle.describe("Name of the team"),
      description: zBody.optional().describe("Description of the team"),
      permission: zPermission.describe("Permission level for the team: read, write, or admin"),
      units: z
        .array(z.string())
        .optional()
        .describe("List of unit types the team has access to (e.g. repo.code, repo.issues)"),
    },
    async (params) => {
      try {
        const data = await client.post(`/orgs/${params.org}/teams`, {
          name: params.name,
          description: params.description,
          permission: params.permission,
          units: params.units,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 11. add_team_member
  server.tool(
    "add_team_member",
    "Add a member to a team",
    {
      id: zId.describe("ID of the team"),
      username: zOwner.describe("Username of the user to add"),
    },
    async (params) => {
      try {
        const data = await client.put(`/teams/${params.id}/members/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 12. remove_team_member
  server.tool(
    "remove_team_member",
    "Remove a member from a team",
    {
      id: zId.describe("ID of the team"),
      username: zOwner.describe("Username of the user to remove"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/teams/${params.id}/members/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 13. list_org_labels
  server.tool(
    "list_org_labels",
    "List labels for an organization",
    {
      org: zOwner.describe("Name of the organization"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/labels`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 14. list_org_hooks
  server.tool(
    "list_org_hooks",
    "List webhooks for an organization",
    {
      org: zOwner.describe("Name of the organization"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/hooks`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
