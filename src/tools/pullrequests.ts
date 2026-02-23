import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient } from "../client.js";
import { formatResponse, formatError } from "./helpers.js";
import { zOwner, zRepo, zPage, zLimit, zIndex, zTitle, zBody, zState, zMergeMethod, zReviewEvent } from "../validation.js";

export function registerPullRequestTools(server: McpServer, client: ForgejoClient): void {
  // 1. List pull requests
  server.tool(
    "list_pull_requests",
    "List pull requests for a repository",
    {
      owner: zOwner,
      repo: zRepo,
      state: zState,
      sort: z.string().optional().describe("Sort field"),
      labels: z.string().optional().describe("Comma-separated label names"),
      milestone: z.string().optional().describe("Milestone name or ID"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const result = await client.get(
          `/repos/${params.owner}/${params.repo}/pulls`,
          {
            state: params.state,
            sort: params.sort,
            labels: params.labels,
            milestone: params.milestone,
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 2. Get a single pull request
  server.tool(
    "get_pull_request",
    "Get details of a single pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
    },
    async (params) => {
      try {
        const result = await client.get(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}`
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 3. Create a pull request
  server.tool(
    "create_pull_request",
    "Create a new pull request",
    {
      owner: zOwner,
      repo: zRepo,
      title: zTitle.describe("PR title"),
      body: zBody.optional().describe("PR description"),
      head: z.string().max(255).describe("Source branch"),
      base: z.string().max(255).describe("Target branch"),
      assignees: z.array(z.string()).optional().describe("Assignee usernames"),
      labels: z.array(z.number()).optional().describe("Label IDs"),
      milestone: z.number().optional().describe("Milestone ID"),
    },
    async (params) => {
      try {
        const result = await client.post(
          `/repos/${params.owner}/${params.repo}/pulls`,
          {
            title: params.title,
            body: params.body,
            head: params.head,
            base: params.base,
            assignees: params.assignees,
            labels: params.labels,
            milestone: params.milestone,
          }
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 4. Edit a pull request
  server.tool(
    "edit_pull_request",
    "Update an existing pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      title: zTitle.optional().describe("New title"),
      body: zBody.optional().describe("New description"),
      state: zState,
      base: z.string().optional().describe("New target branch"),
      assignees: z.array(z.string()).optional().describe("Assignee usernames"),
      labels: z.array(z.number()).optional().describe("Label IDs"),
      milestone: z.number().optional().describe("Milestone ID"),
    },
    async (params) => {
      try {
        const result = await client.patch(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}`,
          {
            title: params.title,
            body: params.body,
            state: params.state,
            base: params.base,
            assignees: params.assignees,
            labels: params.labels,
            milestone: params.milestone,
          }
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 5. Merge a pull request
  server.tool(
    "merge_pull_request",
    "Merge a pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      merge_method: zMergeMethod.describe("Merge method: merge, rebase, rebase-merge, or squash"),
      message: zBody.optional().describe("Merge commit message"),
      title: zTitle.optional().describe("Merge commit title"),
    },
    async (params) => {
      try {
        const result = await client.post(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}/merge`,
          {
            Do: params.merge_method,
            MergeTitleField: params.title,
            MergeMessageField: params.message,
          }
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 6. List commits in a pull request
  server.tool(
    "list_pr_commits",
    "List commits in a pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const result = await client.get(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}/commits`,
          {
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 7. List changed files in a pull request
  server.tool(
    "list_pr_files",
    "List changed files in a pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const result = await client.get(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}/files`,
          {
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 8. Get pull request diff
  server.tool(
    "get_pr_diff",
    "Get the diff of a pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
    },
    async (params) => {
      try {
        const result = await client.getRaw(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}.diff`
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 9. List reviews on a pull request
  server.tool(
    "list_pr_reviews",
    "List reviews on a pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const result = await client.get(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}/reviews`,
          {
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 10. Create a review on a pull request
  server.tool(
    "create_pr_review",
    "Create a review on a pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      body: zBody.describe("Review body/comment"),
      event: zReviewEvent.describe("Review event: APPROVED, REQUEST_CHANGES, or COMMENT"),
      comments: z.array(z.object({
        path: z.string(),
        body: z.string(),
        new_position: z.number(),
      })).optional().describe("Inline comments on specific files"),
    },
    async (params) => {
      try {
        const result = await client.post(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}/reviews`,
          {
            body: params.body,
            event: params.event,
            comments: params.comments,
          }
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 11. Request review from users
  server.tool(
    "request_pr_review",
    "Request review from users on a pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      reviewers: z.array(z.string()).describe("Usernames of requested reviewers"),
    },
    async (params) => {
      try {
        const result = await client.post(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}/requested_reviewers`,
          {
            reviewers: params.reviewers,
          }
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 12. Update pull request branch
  server.tool(
    "update_pr_branch",
    "Update a pull request branch by rebasing on the base branch",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
    },
    async (params) => {
      try {
        const result = await client.post(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}/update`
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
