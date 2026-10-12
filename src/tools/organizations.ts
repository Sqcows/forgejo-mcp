import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient } from "../client.js";
import { formatResponse, formatError } from "./helpers.js";
import { zOwner, zRepo, zPage, zLimit, zId, zTitle, zBody, zVisibility, zPermission, zSearchQuery } from "../validation.js";

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
        // Forgejo returns a 500 when `units` is omitted for read/write teams,
        // so fall back to the standard repo unit set when the caller doesn't
        // specify any. (Owner teams implicitly get all units regardless.)
        const units =
          params.units && params.units.length > 0
            ? params.units
            : [
                "repo.code",
                "repo.issues",
                "repo.ext_issues",
                "repo.wiki",
                "repo.ext_wiki",
                "repo.pulls",
                "repo.releases",
                "repo.projects",
                "repo.packages",
                "repo.actions",
              ];
        const data = await client.post(`/orgs/${params.org}/teams`, {
          name: params.name,
          description: params.description,
          permission: params.permission,
          units,
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

  // 15. create_org_hook
  server.tool(
    "create_org_hook",
    "Create a webhook for an organization",
    {
      org: zOwner.describe("Organization name"),
      type: z.enum(["forgejo", "dingtalk", "discord", "gitea", "gogs", "msteams", "slack", "telegram", "feishu", "wechatwork", "packagist"]).describe("Webhook type"),
      config: z.record(z.string()).describe("Hook configuration, e.g. { url, content_type: \"json\", secret }"),
      events: z.array(z.string()).optional().describe("Events that trigger the hook (e.g. push, issues, pull_request)"),
      active: z.boolean().optional().describe("Whether the hook is active"),
      branch_filter: z.string().max(255).optional().describe("Branch filter glob"),
      authorization_header: z.string().max(2048).optional().describe("Authorization header sent with the webhook"),
    },
    async (params) => {
      try {
        const data = await client.post(`/orgs/${params.org}/hooks`, {
          type: params.type,
          config: params.config,
          events: params.events,
          active: params.active,
          branch_filter: params.branch_filter,
          authorization_header: params.authorization_header,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 16. get_org_hook
  server.tool(
    "get_org_hook",
    "Get a webhook of an organization",
    {
      org: zOwner.describe("Organization name"),
      id: zId.describe("Hook ID"),
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/hooks/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 17. edit_org_hook
  server.tool(
    "edit_org_hook",
    "Update a webhook of an organization",
    {
      org: zOwner.describe("Organization name"),
      id: zId.describe("Hook ID"),
      config: z.record(z.string()).optional().describe("Hook configuration, e.g. { url, content_type, secret }"),
      events: z.array(z.string()).optional().describe("Events that trigger the hook"),
      active: z.boolean().optional().describe("Whether the hook is active"),
      branch_filter: z.string().max(255).optional().describe("Branch filter glob"),
      authorization_header: z.string().max(2048).optional().describe("Authorization header sent with the webhook"),
    },
    async (params) => {
      try {
        const data = await client.patch(`/orgs/${params.org}/hooks/${params.id}`, {
          config: params.config,
          events: params.events,
          active: params.active,
          branch_filter: params.branch_filter,
          authorization_header: params.authorization_header,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 18. delete_org_hook
  server.tool(
    "delete_org_hook",
    "Delete a webhook from an organization",
    {
      org: zOwner.describe("Organization name"),
      id: zId.describe("Hook ID"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/orgs/${params.org}/hooks/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 19. create_org_label
  server.tool(
    "create_org_label",
    "Create a label for an organization",
    {
      org: zOwner.describe("Organization name"),
      name: zTitle.describe("Label name"),
      color: z.string().regex(/^#?[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color").describe("Label color as hex, e.g. #00aabb"),
      description: zBody.optional().describe("Label description"),
      exclusive: z.boolean().optional().describe("Whether the label is exclusive within its scope"),
      is_archived: z.boolean().optional().describe("Whether the label is archived"),
    },
    async (params) => {
      try {
        const data = await client.post(`/orgs/${params.org}/labels`, {
          name: params.name,
          color: params.color,
          description: params.description,
          exclusive: params.exclusive,
          is_archived: params.is_archived,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 20. get_org_label
  server.tool(
    "get_org_label",
    "Get a single organization label",
    {
      org: zOwner.describe("Organization name"),
      id: zId.describe("Label ID"),
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/labels/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 21. edit_org_label
  server.tool(
    "edit_org_label",
    "Update an organization label",
    {
      org: zOwner.describe("Organization name"),
      id: zId.describe("Label ID"),
      name: zTitle.optional().describe("New label name"),
      color: z.string().regex(/^#?[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color").optional().describe("New label color as hex"),
      description: zBody.optional().describe("New label description"),
      exclusive: z.boolean().optional().describe("Whether the label is exclusive within its scope"),
      is_archived: z.boolean().optional().describe("Whether the label is archived"),
    },
    async (params) => {
      try {
        const data = await client.patch(`/orgs/${params.org}/labels/${params.id}`, {
          name: params.name,
          color: params.color,
          description: params.description,
          exclusive: params.exclusive,
          is_archived: params.is_archived,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 22. delete_org_label
  server.tool(
    "delete_org_label",
    "Delete an organization label",
    {
      org: zOwner.describe("Organization name"),
      id: zId.describe("Label ID"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/orgs/${params.org}/labels/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 23. check_org_member
  server.tool(
    "check_org_member",
    "Check if a user is a member of an organization (succeeds if they are, 404 error if not)",
    {
      org: zOwner.describe("Organization name"),
      username: zOwner.describe("Username"),
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/members/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 24. remove_org_member
  server.tool(
    "remove_org_member",
    "Remove a member from an organization",
    {
      org: zOwner.describe("Organization name"),
      username: zOwner.describe("Username"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/orgs/${params.org}/members/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 25. list_org_public_members
  server.tool(
    "list_org_public_members",
    "List an organization's public members",
    {
      org: zOwner.describe("Organization name"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/public_members`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 26. check_org_public_member
  server.tool(
    "check_org_public_member",
    "Check if a user is a public member of an organization (succeeds if they are, 404 error if not)",
    {
      org: zOwner.describe("Organization name"),
      username: zOwner.describe("Username"),
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/public_members/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 27. publicize_org_membership
  server.tool(
    "publicize_org_membership",
    "Make a user's membership of an organization public",
    {
      org: zOwner.describe("Organization name"),
      username: zOwner.describe("Username"),
    },
    async (params) => {
      try {
        const data = await client.put(`/orgs/${params.org}/public_members/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 28. conceal_org_membership
  server.tool(
    "conceal_org_membership",
    "Conceal a user's membership of an organization",
    {
      org: zOwner.describe("Organization name"),
      username: zOwner.describe("Username"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/orgs/${params.org}/public_members/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 29. list_org_blocked_users
  server.tool(
    "list_org_blocked_users",
    "List the users blocked by an organization",
    {
      org: zOwner.describe("Organization name"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/list_blocked`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 30. org_block_user
  server.tool(
    "org_block_user",
    "Block a user from an organization",
    {
      org: zOwner.describe("Organization name"),
      username: zOwner.describe("Username"),
    },
    async (params) => {
      try {
        const data = await client.put(`/orgs/${params.org}/block/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 31. org_unblock_user
  server.tool(
    "org_unblock_user",
    "Unblock a user from an organization",
    {
      org: zOwner.describe("Organization name"),
      username: zOwner.describe("Username"),
    },
    async (params) => {
      try {
        const data = await client.put(`/orgs/${params.org}/unblock/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 32. get_org_quota
  server.tool(
    "get_org_quota",
    "Get quota information for an organization",
    {
      org: zOwner.describe("Organization name"),
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/quota`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 33. list_org_quota_artifacts
  server.tool(
    "list_org_quota_artifacts",
    "List the artifacts affecting an organization's quota",
    {
      org: zOwner.describe("Organization name"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/quota/artifacts`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 34. list_org_quota_attachments
  server.tool(
    "list_org_quota_attachments",
    "List the attachments affecting an organization's quota",
    {
      org: zOwner.describe("Organization name"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/quota/attachments`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 35. list_org_quota_packages
  server.tool(
    "list_org_quota_packages",
    "List the packages affecting an organization's quota",
    {
      org: zOwner.describe("Organization name"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/quota/packages`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 36. check_org_quota
  server.tool(
    "check_org_quota",
    "Check if an organization is over quota for a given subject",
    {
      org: zOwner.describe("Organization name"),
      subject: z.string().min(1).max(255).describe("Quota subject to check, e.g. size:all, size:repos:all, size:git:all, size:assets:packages:all"),
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/quota/check`, {
          subject: params.subject,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 37. rename_org
  server.tool(
    "rename_org",
    "Rename an organization",
    {
      org: zOwner.describe("Organization name"),
      new_name: zOwner.describe("New organization name"),
    },
    async (params) => {
      try {
        const data = await client.post(`/orgs/${params.org}/rename`, {
          new_name: params.new_name,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 38. search_org_teams
  server.tool(
    "search_org_teams",
    "Search for teams within an organization",
    {
      org: zOwner.describe("Organization name"),
      q: zSearchQuery.optional().describe("Keywords to search for"),
      include_desc: z.boolean().optional().describe("Also search team descriptions"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/teams/search`, {
          q: params.q,
          include_desc: params.include_desc,
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 39. list_org_activity_feeds
  server.tool(
    "list_org_activity_feeds",
    "List an organization's activity feeds",
    {
      org: zOwner.describe("Organization name"),
      date: z.string().max(32).optional().describe("Only show activity on this date (YYYY-MM-DD)"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/activities/feeds`, {
          date: params.date,
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 40. list_team_activity_feeds
  server.tool(
    "list_team_activity_feeds",
    "List a team's activity feeds",
    {
      id: zId.describe("Team ID"),
      date: z.string().max(32).optional().describe("Only show activity on this date (YYYY-MM-DD)"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/teams/${params.id}/activities/feeds`, {
          date: params.date,
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 41. edit_team
  server.tool(
    "edit_team",
    "Edit a team",
    {
      id: zId.describe("Team ID"),
      name: zTitle.describe("Team name (required by the API, pass the current name to keep it)"),
      description: zBody.optional().describe("Team description"),
      permission: zPermission.describe("Team permission level"),
      can_create_org_repo: z.boolean().optional().describe("Whether team members can create repositories in the organization"),
      includes_all_repositories: z.boolean().optional().describe("Whether the team has access to all repositories"),
      units: z.array(z.string()).optional().describe("Repository units the team can access, e.g. repo.code, repo.issues"),
      units_map: z.record(z.string()).optional().describe("Map of repository unit to permission, e.g. { \"repo.code\": \"write\" }"),
    },
    async (params) => {
      try {
        const data = await client.patch(`/teams/${params.id}`, {
          name: params.name,
          description: params.description,
          permission: params.permission,
          can_create_org_repo: params.can_create_org_repo,
          includes_all_repositories: params.includes_all_repositories,
          units: params.units,
          units_map: params.units_map,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 42. delete_team
  server.tool(
    "delete_team",
    "Delete a team",
    {
      id: zId.describe("Team ID"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/teams/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 43. list_team_members
  server.tool(
    "list_team_members",
    "List a team's members",
    {
      id: zId.describe("Team ID"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/teams/${params.id}/members`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 44. get_team_member
  server.tool(
    "get_team_member",
    "Get a particular member of a team (404 error if the user is not a member)",
    {
      id: zId.describe("Team ID"),
      username: zOwner.describe("Username"),
    },
    async (params) => {
      try {
        const data = await client.get(`/teams/${params.id}/members/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 45. list_team_repos
  server.tool(
    "list_team_repos",
    "List a team's repositories",
    {
      id: zId.describe("Team ID"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/teams/${params.id}/repos`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 46. get_team_repo
  server.tool(
    "get_team_repo",
    "Get a particular repository of a team (404 error if the team has no access)",
    {
      id: zId.describe("Team ID"),
      org: zOwner.describe("Organization name"),
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(`/teams/${params.id}/repos/${params.org}/${params.repo}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 47. add_team_repo
  server.tool(
    "add_team_repo",
    "Add a repository to a team",
    {
      id: zId.describe("Team ID"),
      org: zOwner.describe("Organization name"),
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.put(`/teams/${params.id}/repos/${params.org}/${params.repo}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 48. remove_team_repo
  server.tool(
    "remove_team_repo",
    "Remove a repository from a team",
    {
      id: zId.describe("Team ID"),
      org: zOwner.describe("Organization name"),
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.delete(`/teams/${params.id}/repos/${params.org}/${params.repo}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 49. list_my_orgs
  server.tool(
    "list_my_orgs",
    "List the authenticated user's organizations",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/user/orgs", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 50. get_user_org_permissions
  server.tool(
    "get_user_org_permissions",
    "Get a user's permissions in an organization",
    {
      username: zOwner.describe("Username"),
      org: zOwner.describe("Organization name"),
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/orgs/${params.org}/permissions`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
