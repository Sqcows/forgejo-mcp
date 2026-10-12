import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient } from "../client.js";
import { formatResponse, formatError } from "./helpers.js";
import { zOwner, zRepo, zPage, zLimit, zIndex, zId, zTitle, zBody, zState, zName, zSearchQuery } from "../validation.js";

const zReaction = z.string().min(1).max(64).describe("Reaction content, e.g. '+1', '-1', 'laugh', 'hooray', 'confused', 'heart', 'rocket', 'eyes'");
const zIssueSort = z
  .enum(["relevance", "latest", "oldest", "recentupdate", "leastupdate", "mostcomment", "leastcomment", "nearduedate", "farduedate"])
  .optional()
  .describe("Sort order");

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
      q: zSearchQuery.optional().describe("Search string"),
      since: z.string().optional().describe("Only show items updated after this time (RFC 3339)"),
      before: z.string().optional().describe("Only show items updated before this time (RFC 3339)"),
      created_by: zOwner.optional().describe("Only show items created by this user"),
      assigned_by: zOwner.optional().describe("Only show items assigned to this user"),
      mentioned_by: zOwner.optional().describe("Only show items mentioning this user"),
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

  // 21. search_issues
  server.tool(
    "search_issues",
    "Search for issues and pull requests across all repositories the user has access to",
    {
      q: zSearchQuery.optional().describe("Search string"),
      state: zState,
      labels: z.string().optional().describe("Comma-separated list of label names"),
      milestones: z.string().optional().describe("Comma-separated list of milestone names"),
      type: z.enum(["issues", "pulls"]).optional().describe("Filter by type: issues or pulls"),
      priority_repo_id: z.number().int().positive().optional().describe("Repository ID to prioritize in the results"),
      since: z.string().optional().describe("Only show items updated after this time (RFC 3339 timestamp)"),
      before: z.string().optional().describe("Only show items updated before this time (RFC 3339 timestamp)"),
      assigned: z.boolean().optional().describe("Only issues assigned to the authenticated user"),
      created: z.boolean().optional().describe("Only issues created by the authenticated user"),
      mentioned: z.boolean().optional().describe("Only issues mentioning the authenticated user"),
      review_requested: z.boolean().optional().describe("Only pull requests where the authenticated user's review was requested"),
      reviewed: z.boolean().optional().describe("Only pull requests reviewed by the authenticated user"),
      owner: zOwner.optional().describe("Only issues in repositories owned by this user or organization"),
      team: zName.optional().describe("Only issues in repositories of this team (requires owner to be an organization)"),
      sort: zIssueSort,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const result = await client.get("/repos/issues/search", params);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 22. delete_issue
  server.tool(
    "delete_issue",
    "Delete an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/issues/${params.index}`);
        return formatResponse({ message: "Issue deleted successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 23. list_repo_comments
  server.tool(
    "list_repo_comments",
    "List all issue and pull request comments in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      since: z.string().optional().describe("Only show items updated after this time (RFC 3339 timestamp)"),
      before: z.string().optional().describe("Only show items updated before this time (RFC 3339 timestamp)"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const { owner, repo, ...query } = params;
        const result = await client.get(`/repos/${owner}/${repo}/issues/comments`, query);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 24. get_issue_comment
  server.tool(
    "get_issue_comment",
    "Get a single issue comment by ID",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Comment ID"),
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/issues/comments/${params.id}`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 25. list_issue_reactions
  server.tool(
    "list_issue_reactions",
    "List reactions on an issue",
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
        const result = await client.get(`/repos/${owner}/${repo}/issues/${index}/reactions`, query);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 26. add_issue_reaction
  server.tool(
    "add_issue_reaction",
    "Add a reaction to an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      content: zReaction,
    },
    async (params) => {
      try {
        const { owner, repo, index, ...body } = params;
        const result = await client.post(`/repos/${owner}/${repo}/issues/${index}/reactions`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 27. remove_issue_reaction
  server.tool(
    "remove_issue_reaction",
    "Remove a reaction from an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      content: zReaction,
    },
    async (params) => {
      try {
        const { owner, repo, index, ...body } = params;
        await client.delete(`/repos/${owner}/${repo}/issues/${index}/reactions`, body);
        return formatResponse({ message: "Reaction removed successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 28. list_comment_reactions
  server.tool(
    "list_comment_reactions",
    "List reactions on an issue comment",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Comment ID"),
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/issues/comments/${params.id}/reactions`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 29. add_comment_reaction
  server.tool(
    "add_comment_reaction",
    "Add a reaction to an issue comment",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Comment ID"),
      content: zReaction,
    },
    async (params) => {
      try {
        const { owner, repo, id, ...body } = params;
        const result = await client.post(`/repos/${owner}/${repo}/issues/comments/${id}/reactions`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 30. remove_comment_reaction
  server.tool(
    "remove_comment_reaction",
    "Remove a reaction from an issue comment",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Comment ID"),
      content: zReaction,
    },
    async (params) => {
      try {
        const { owner, repo, id, ...body } = params;
        await client.delete(`/repos/${owner}/${repo}/issues/comments/${id}/reactions`, body);
        return formatResponse({ message: "Reaction removed successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 31. list_issue_dependencies
  server.tool(
    "list_issue_dependencies",
    "List the issues that block this issue (its dependencies)",
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
        const result = await client.get(`/repos/${owner}/${repo}/issues/${index}/dependencies`, query);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 32. add_issue_dependency
  server.tool(
    "add_issue_dependency",
    "Make an issue depend on another issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      target_owner: zOwner.describe("Owner of the repository containing the issue to depend on"),
      target_repo: zRepo.describe("Repository containing the issue to depend on"),
      target_index: zIndex.describe("Index of the issue to depend on"),
    },
    async (params) => {
      try {
        const result = await client.post(`/repos/${params.owner}/${params.repo}/issues/${params.index}/dependencies`, { owner: params.target_owner, repo: params.target_repo, index: params.target_index });
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 33. remove_issue_dependency
  server.tool(
    "remove_issue_dependency",
    "Remove a dependency from an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      target_owner: zOwner.describe("Owner of the repository containing the dependency to remove"),
      target_repo: zRepo.describe("Repository containing the dependency to remove"),
      target_index: zIndex.describe("Index of the dependency to remove"),
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/issues/${params.index}/dependencies`, { owner: params.target_owner, repo: params.target_repo, index: params.target_index });
        return formatResponse({ message: "Dependency removed successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 34. list_issue_blocks
  server.tool(
    "list_issue_blocks",
    "List the issues that are blocked by this issue",
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
        const result = await client.get(`/repos/${owner}/${repo}/issues/${index}/blocks`, query);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 35. add_issue_block
  server.tool(
    "add_issue_block",
    "Mark another issue as blocked by this issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      target_owner: zOwner.describe("Owner of the repository containing the issue to block"),
      target_repo: zRepo.describe("Repository containing the issue to block"),
      target_index: zIndex.describe("Index of the issue to block"),
    },
    async (params) => {
      try {
        const result = await client.post(`/repos/${params.owner}/${params.repo}/issues/${params.index}/blocks`, { owner: params.target_owner, repo: params.target_repo, index: params.target_index });
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 36. remove_issue_block
  server.tool(
    "remove_issue_block",
    "Unblock another issue that is blocked by this issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      target_owner: zOwner.describe("Owner of the repository containing the issue to unblock"),
      target_repo: zRepo.describe("Repository containing the issue to unblock"),
      target_index: zIndex.describe("Index of the issue to unblock"),
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/issues/${params.index}/blocks`, { owner: params.target_owner, repo: params.target_repo, index: params.target_index });
        return formatResponse({ message: "Block removed successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 37. get_issue_labels
  server.tool(
    "get_issue_labels",
    "Get the labels of an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/issues/${params.index}/labels`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 38. replace_issue_labels
  server.tool(
    "replace_issue_labels",
    "Replace all of an issue's labels",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      labels: z.array(z.union([z.number(), z.string()])).describe("Array of label IDs or label names"),
    },
    async (params) => {
      try {
        const { owner, repo, index, ...body } = params;
        const result = await client.put(`/repos/${owner}/${repo}/issues/${index}/labels`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 39. clear_issue_labels
  server.tool(
    "clear_issue_labels",
    "Remove all labels from an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/issues/${params.index}/labels`);
        return formatResponse({ message: "Labels cleared successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 40. pin_issue
  server.tool(
    "pin_issue",
    "Pin an issue or pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
    },
    async (params) => {
      try {
        await client.post(`/repos/${params.owner}/${params.repo}/issues/${params.index}/pin`);
        return formatResponse({ message: "Issue pinned successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 41. unpin_issue
  server.tool(
    "unpin_issue",
    "Unpin an issue or pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/issues/${params.index}/pin`);
        return formatResponse({ message: "Issue unpinned successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 42. move_issue_pin
  server.tool(
    "move_issue_pin",
    "Move a pinned issue to a new position",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      position: z.number().int().positive().describe("New pin position (starts at 1)"),
    },
    async (params) => {
      try {
        await client.patch(`/repos/${params.owner}/${params.repo}/issues/${params.index}/pin/${params.position}`);
        return formatResponse({ message: "Pin moved successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 43. list_pinned_issues
  server.tool(
    "list_pinned_issues",
    "List a repository's pinned issues",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/issues/pinned`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 44. check_new_pin_allowed
  server.tool(
    "check_new_pin_allowed",
    "Check whether new issue and pull request pins are allowed in a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/new_pin_allowed`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 45. set_issue_deadline
  server.tool(
    "set_issue_deadline",
    "Set or remove the deadline of an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      due_date: z.string().nullable().describe("Deadline in ISO 8601 format (only the date is used), or null to remove the deadline"),
    },
    async (params) => {
      try {
        const { owner, repo, index, ...body } = params;
        const result = await client.post(`/repos/${owner}/${repo}/issues/${index}/deadline`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 46. list_issue_timeline
  server.tool(
    "list_issue_timeline",
    "List all comments and events on an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      since: z.string().optional().describe("Only show items updated after this time (RFC 3339 timestamp)"),
      before: z.string().optional().describe("Only show items updated before this time (RFC 3339 timestamp)"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const { owner, repo, index, ...query } = params;
        const result = await client.get(`/repos/${owner}/${repo}/issues/${index}/timeline`, query);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 47. list_issue_tracked_times
  server.tool(
    "list_issue_tracked_times",
    "List an issue's tracked times",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      user: zOwner.optional().describe("Only show times tracked by this username"),
      since: z.string().optional().describe("Only show items updated after this time (RFC 3339 timestamp)"),
      before: z.string().optional().describe("Only show items updated before this time (RFC 3339 timestamp)"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const { owner, repo, index, ...query } = params;
        const result = await client.get(`/repos/${owner}/${repo}/issues/${index}/times`, query);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 48. add_issue_tracked_time
  server.tool(
    "add_issue_tracked_time",
    "Add tracked time to an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      time: z.number().int().positive().describe("Time to add in seconds"),
      created: z.string().optional().describe("When the time was tracked, in ISO 8601 format"),
      user_name: zOwner.optional().describe("User who spent the time (defaults to the authenticated user)"),
    },
    async (params) => {
      try {
        const { owner, repo, index, ...body } = params;
        const result = await client.post(`/repos/${owner}/${repo}/issues/${index}/times`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 49. reset_issue_tracked_times
  server.tool(
    "reset_issue_tracked_times",
    "Reset all tracked time of an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/issues/${params.index}/times`);
        return formatResponse({ message: "Tracked times reset successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 50. delete_issue_tracked_time
  server.tool(
    "delete_issue_tracked_time",
    "Delete a specific tracked time entry from an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      id: zId.describe("Tracked time ID"),
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/issues/${params.index}/times/${params.id}`);
        return formatResponse({ message: "Tracked time deleted successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 51. list_repo_tracked_times
  server.tool(
    "list_repo_tracked_times",
    "List a repository's tracked times",
    {
      owner: zOwner,
      repo: zRepo,
      user: zOwner.optional().describe("Only show times tracked by this username"),
      since: z.string().optional().describe("Only show items updated after this time (RFC 3339 timestamp)"),
      before: z.string().optional().describe("Only show items updated before this time (RFC 3339 timestamp)"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const { owner, repo, ...query } = params;
        const result = await client.get(`/repos/${owner}/${repo}/times`, query);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 52. start_issue_stopwatch
  server.tool(
    "start_issue_stopwatch",
    "Start a stopwatch on an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
    },
    async (params) => {
      try {
        await client.post(`/repos/${params.owner}/${params.repo}/issues/${params.index}/stopwatch/start`);
        return formatResponse({ message: "Stopwatch started successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 53. stop_issue_stopwatch
  server.tool(
    "stop_issue_stopwatch",
    "Stop an issue's stopwatch and record the tracked time",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
    },
    async (params) => {
      try {
        await client.post(`/repos/${params.owner}/${params.repo}/issues/${params.index}/stopwatch/stop`);
        return formatResponse({ message: "Stopwatch stopped successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 54. delete_issue_stopwatch
  server.tool(
    "delete_issue_stopwatch",
    "Delete an issue's stopwatch without recording time",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/issues/${params.index}/stopwatch/delete`);
        return formatResponse({ message: "Stopwatch deleted successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 55. list_issue_subscriptions
  server.tool(
    "list_issue_subscriptions",
    "List the users subscribed to an issue",
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
        const result = await client.get(`/repos/${owner}/${repo}/issues/${index}/subscriptions`, query);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 56. check_issue_subscription
  server.tool(
    "check_issue_subscription",
    "Check whether the authenticated user is subscribed to an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/issues/${params.index}/subscriptions/check`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 57. subscribe_issue
  server.tool(
    "subscribe_issue",
    "Subscribe a user to an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      user: zOwner.describe("Username to subscribe"),
    },
    async (params) => {
      try {
        await client.put(`/repos/${params.owner}/${params.repo}/issues/${params.index}/subscriptions/${params.user}`);
        return formatResponse({ message: "User subscribed successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 58. unsubscribe_issue
  server.tool(
    "unsubscribe_issue",
    "Unsubscribe a user from an issue",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      user: zOwner.describe("Username to unsubscribe"),
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/issues/${params.index}/subscriptions/${params.user}`);
        return formatResponse({ message: "User unsubscribed successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 59. list_issue_attachments
  server.tool(
    "list_issue_attachments",
    "List an issue's attachments",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/issues/${params.index}/assets`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 60. get_issue_attachment
  server.tool(
    "get_issue_attachment",
    "Get an issue attachment",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      attachment_id: zId.describe("Attachment ID"),
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/issues/${params.index}/assets/${params.attachment_id}`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 61. edit_issue_attachment
  server.tool(
    "edit_issue_attachment",
    "Edit an issue attachment",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      attachment_id: zId.describe("Attachment ID"),
      name: zTitle.optional().describe("New attachment name"),
      browser_download_url: z.string().url().max(2048).optional().describe("New download URL (only for external attachments)"),
    },
    async (params) => {
      try {
        const { owner, repo, index, attachment_id, ...body } = params;
        const result = await client.patch(`/repos/${owner}/${repo}/issues/${index}/assets/${attachment_id}`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 62. delete_issue_attachment
  server.tool(
    "delete_issue_attachment",
    "Delete an issue attachment",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex,
      attachment_id: zId.describe("Attachment ID"),
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/issues/${params.index}/assets/${params.attachment_id}`);
        return formatResponse({ message: "Attachment deleted successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 63. list_comment_attachments
  server.tool(
    "list_comment_attachments",
    "List an issue comment's attachments",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Comment ID"),
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/issues/comments/${params.id}/assets`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 64. get_comment_attachment
  server.tool(
    "get_comment_attachment",
    "Get an issue comment attachment",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Comment ID"),
      attachment_id: zId.describe("Attachment ID"),
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/issues/comments/${params.id}/assets/${params.attachment_id}`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 65. edit_comment_attachment
  server.tool(
    "edit_comment_attachment",
    "Edit an issue comment attachment",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Comment ID"),
      attachment_id: zId.describe("Attachment ID"),
      name: zTitle.optional().describe("New attachment name"),
      browser_download_url: z.string().url().max(2048).optional().describe("New download URL (only for external attachments)"),
    },
    async (params) => {
      try {
        const { owner, repo, id, attachment_id, ...body } = params;
        const result = await client.patch(`/repos/${owner}/${repo}/issues/comments/${id}/assets/${attachment_id}`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 66. delete_comment_attachment
  server.tool(
    "delete_comment_attachment",
    "Delete an issue comment attachment",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Comment ID"),
      attachment_id: zId.describe("Attachment ID"),
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/issues/comments/${params.id}/assets/${params.attachment_id}`);
        return formatResponse({ message: "Attachment deleted successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
