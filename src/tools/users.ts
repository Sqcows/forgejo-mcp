import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient } from "../client.js";
import { formatResponse, formatError } from "./helpers.js";
import { zOwner, zRepo, zPage, zLimit, zSearchQuery, zState } from "../validation.js";

export function registerUserTools(server: McpServer, client: ForgejoClient): void {
  // 1. get_authenticated_user
  server.tool(
    "get_authenticated_user",
    "Get the currently authenticated user",
    {},
    async () => {
      try {
        const data = await client.get("/user");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 2. get_user
  server.tool(
    "get_user",
    "Get a user's profile by username",
    {
      username: zOwner.describe("Username of the user"),
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 3. list_user_repos
  server.tool(
    "list_user_repos",
    "List repositories owned by a user",
    {
      username: zOwner.describe("Username of the user"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/repos`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 4. list_user_orgs
  server.tool(
    "list_user_orgs",
    "List organizations a user belongs to",
    {
      username: zOwner.describe("Username of the user"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/orgs`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 5. search_users
  server.tool(
    "search_users",
    "Search for users on the Forgejo instance",
    {
      q: zSearchQuery.describe("Search query string"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/users/search", {
          q: params.q,
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 6. list_followers
  server.tool(
    "list_followers",
    "List a user's followers",
    {
      username: zOwner.describe("Username of the user"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/followers`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 7. list_following
  server.tool(
    "list_following",
    "List who a user is following",
    {
      username: zOwner.describe("Username of the user"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/following`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 8. list_user_starred
  server.tool(
    "list_user_starred",
    "List repositories starred by a user",
    {
      username: zOwner.describe("Username of the user"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/starred`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 9. list_my_starred
  server.tool(
    "list_my_starred",
    "List repositories starred by the authenticated user",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/user/starred", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 10. star_repo
  server.tool(
    "star_repo",
    "Star a repository for the authenticated user",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.put(`/user/starred/${params.owner}/${params.repo}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 11. unstar_repo
  server.tool(
    "unstar_repo",
    "Unstar a repository for the authenticated user",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.delete(`/user/starred/${params.owner}/${params.repo}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 12. list_my_notifications
  server.tool(
    "list_my_notifications",
    "List notifications for the authenticated user",
    {
      page: zPage,
      limit: zLimit,
      status_types: z
        .enum(["unread", "read", "pinned"])
        .optional()
        .describe("Filter by status type: unread, read, or pinned"),
    },
    async (params) => {
      try {
        const data = await client.get("/notifications", {
          page: params.page,
          limit: params.limit,
          status_types: params.status_types,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 13. mark_notifications_read
  server.tool(
    "mark_notifications_read",
    "Mark all notifications as read for the authenticated user",
    {},
    async () => {
      try {
        const data = await client.put("/notifications");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
