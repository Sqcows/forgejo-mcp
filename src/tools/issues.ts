import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient } from "../client.js";
import { formatResponse, formatError } from "./helpers.js";
import { zOwner, zRepo, zPage, zLimit, zIndex, zId, zTitle, zBody, zState } from "../validation.js";

export function registerIssueTools(server: McpServer, client: ForgejoClient): void {
  // 1. list_issues
  server.tool(
    "list_issues",
    "List issues for a repository",
    {
      owner: zOwner,
      repo: zRepo,
      state: zState,
      labels: z.string().optional().describe("Comma-separated list of label names"),
      page: zPage,
      limit: zLimit,
      type: z.string().optional().describe("Filter by type: issues or pulls"),
      milestones: z.string().optional().describe("Comma-separated list of milestone names"),
      sort: z.string().optional().describe("Sort order"),
    },
    async (params) => {
      try {
        const { owner, repo, ...query } = params;
        const result = await client.get(`/repos/${owner}/${repo}/issues`, query);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 2. get_issue
  server.tool(
    "get_issue",
    "Get a single issue by index",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/issues/${params.index}`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 3. create_issue
  server.tool(
    "create_issue",
    "Create a new issue in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      title: zTitle.describe("Issue title"),
      body: zBody.optional().describe("Issue body"),
      labels: z.array(z.number()).optional().describe("Array of label IDs"),
      milestone: z.number().optional().describe("Milestone ID"),
      assignees: z.array(z.string()).optional().describe("Array of assignee usernames"),
    },
    async (params) => {
      try {
        const { owner, repo, ...body } = params;
        const result = await client.post(`/repos/${owner}/${repo}/issues`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 4. edit_issue
  server.tool(
    "edit_issue",
    "Edit an existing issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      title: zTitle.optional().describe("New title"),
      body: zBody.optional().describe("New body"),
      state: zState,
      labels: z.array(z.number()).optional().describe("Array of label IDs"),
      milestone: z.number().optional().describe("Milestone ID"),
      assignees: z.array(z.string()).optional().describe("Array of assignee usernames"),
    },
    async (params) => {
      try {
        const { owner, repo, index, ...body } = params;
        const result = await client.patch(`/repos/${owner}/${repo}/issues/${index}`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 5. list_issue_comments
  server.tool(
    "list_issue_comments",
    "List comments on an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const { owner, repo, index, ...query } = params;
        const result = await client.get(`/repos/${owner}/${repo}/issues/${index}/comments`, query);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 6. create_issue_comment
  server.tool(
    "create_issue_comment",
    "Add a comment to an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      body: zBody.describe("Comment body"),
    },
    async (params) => {
      try {
        const { owner, repo, index, body } = params;
        const result = await client.post(`/repos/${owner}/${repo}/issues/${index}/comments`, { body });
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 7. edit_issue_comment
  server.tool(
    "edit_issue_comment",
    "Edit a comment on an issue",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId,
      body: zBody.describe("New comment body"),
    },
    async (params) => {
      try {
        const { owner, repo, id, body } = params;
        const result = await client.patch(`/repos/${owner}/${repo}/issues/comments/${id}`, { body });
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 8. delete_issue_comment
  server.tool(
    "delete_issue_comment",
    "Delete a comment on an issue",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId,
    },
    async (params) => {
      try {
        const { owner, repo, id } = params;
        await client.delete(`/repos/${owner}/${repo}/issues/comments/${id}`);
        return formatResponse({ message: "Comment deleted successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 9. list_labels
  server.tool(
    "list_labels",
    "List labels for a repository",
    {
      owner: zOwner,
      repo: zRepo,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const { owner, repo, ...query } = params;
        const result = await client.get(`/repos/${owner}/${repo}/labels`, query);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 10. get_label
  server.tool(
    "get_label",
    "Get a single label by ID",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId,
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/labels/${params.id}`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 11. create_label
  server.tool(
    "create_label",
    "Create a label in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      name: zTitle.describe("Label name"),
      color: z.string().regex(/^[0-9a-fA-F]{6}$/, "Must be a 6-char hex color").describe("Label color as hex string without #"),
      description: zBody.optional().describe("Label description"),
    },
    async (params) => {
      try {
        const { owner, repo, ...body } = params;
        const result = await client.post(`/repos/${owner}/${repo}/labels`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 12. edit_label
  server.tool(
    "edit_label",
    "Edit an existing label",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId,
      name: zTitle.optional().describe("New label name"),
      color: z.string().regex(/^[0-9a-fA-F]{6}$/, "Must be a 6-char hex color").optional().describe("New label color as hex string without #"),
      description: zBody.optional().describe("New label description"),
    },
    async (params) => {
      try {
        const { owner, repo, id, ...body } = params;
        const result = await client.patch(`/repos/${owner}/${repo}/labels/${id}`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 13. delete_label
  server.tool(
    "delete_label",
    "Delete a label from a repository",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId,
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/labels/${params.id}`);
        return formatResponse({ message: "Label deleted successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 14. add_issue_labels
  server.tool(
    "add_issue_labels",
    "Add labels to an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      labels: z.array(z.number()).describe("Array of label IDs to add"),
    },
    async (params) => {
      try {
        const { owner, repo, index, labels } = params;
        const result = await client.post(`/repos/${owner}/${repo}/issues/${index}/labels`, { labels });
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 15. remove_issue_label
  server.tool(
    "remove_issue_label",
    "Remove a label from an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      id: zId,
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/issues/${params.index}/labels/${params.id}`);
        return formatResponse({ message: "Label removed from issue successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 16. list_milestones
  server.tool(
    "list_milestones",
    "List milestones for a repository",
    {
      owner: zOwner,
      repo: zRepo,
      state: zState,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const { owner, repo, ...query } = params;
        const result = await client.get(`/repos/${owner}/${repo}/milestones`, query);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 17. get_milestone
  server.tool(
    "get_milestone",
    "Get a single milestone by ID",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId,
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/milestones/${params.id}`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 18. create_milestone
  server.tool(
    "create_milestone",
    "Create a milestone in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      title: zTitle.describe("Milestone title"),
      description: zBody.optional().describe("Milestone description"),
      due_on: z.string().optional().describe("Due date in ISO 8601 format"),
      state: zState,
    },
    async (params) => {
      try {
        const { owner, repo, ...body } = params;
        const result = await client.post(`/repos/${owner}/${repo}/milestones`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 19. edit_milestone
  server.tool(
    "edit_milestone",
    "Edit an existing milestone",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId,
      title: zTitle.optional().describe("New title"),
      description: zBody.optional().describe("New description"),
      due_on: z.string().optional().describe("New due date in ISO 8601 format"),
      state: zState,
    },
    async (params) => {
      try {
        const { owner, repo, id, ...body } = params;
        const result = await client.patch(`/repos/${owner}/${repo}/milestones/${id}`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 20. delete_milestone
  server.tool(
    "delete_milestone",
    "Delete a milestone from a repository",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId,
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/milestones/${params.id}`);
        return formatResponse({ message: "Milestone deleted successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
