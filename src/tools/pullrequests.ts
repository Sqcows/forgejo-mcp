import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient, ForgejoApiError } from "../client.js";
import { formatResponse, formatError } from "./helpers.js";
import { zOwner, zRepo, zBranch, zFilePath, zPage, zLimit, zIndex, zId, zSha, zTitle, zBody, zState, zReviewEvent } from "../validation.js";

const zMergeDo = z
  .enum(["merge", "rebase", "rebase-merge", "squash", "fast-forward-only", "manually-merged"])
  .default("merge");
const zCreateReviewEvent = z.enum(["APPROVED", "REQUEST_CHANGES", "COMMENT", "PENDING"]);

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
      poster: zOwner.optional().describe("Filter by pull request author username"),
      base: zBranch.optional().describe("Filter by target base branch"),
      head: zBranch.optional().describe("Filter by head branch, or 'owner:branch' for a fork"),
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
            poster: params.poster,
            base: params.base,
            head: params.head,
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
      due_date: z.string().optional().describe("Due date in ISO 8601 format"),
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
            due_date: params.due_date,
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
      due_date: z.string().optional().describe("Due date in ISO 8601 format"),
      unset_due_date: z.boolean().optional().describe("Remove the due date"),
      allow_maintainer_edit: z.boolean().optional().describe("Allow maintainers of the base repository to push to the head branch"),
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
            due_date: params.due_date,
            unset_due_date: params.unset_due_date,
            allow_maintainer_edit: params.allow_maintainer_edit,
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
      merge_method: zMergeDo.describe("Merge method: merge, rebase, rebase-merge, squash, fast-forward-only, or manually-merged"),
      message: zBody.optional().describe("Merge commit message"),
      title: zTitle.optional().describe("Merge commit title"),
      merge_commit_id: zSha.optional().describe("Commit SHA of the merge (required for manually-merged)"),
      head_commit_id: zSha.optional().describe("Expected head commit SHA; the merge fails if the head has changed"),
      delete_branch_after_merge: z.boolean().optional().describe("Delete the head branch after merging"),
      force_merge: z.boolean().optional().describe("Merge even if checks or required approvals are not satisfied (requires permission)"),
      merge_when_checks_succeed: z.boolean().optional().describe("Schedule an auto merge once all checks succeed"),
    },
    async (params) => {
      try {
        const result = await client.post(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}/merge`,
          {
            Do: params.merge_method,
            MergeTitleField: params.title,
            MergeMessageField: params.message,
            MergeCommitID: params.merge_commit_id,
            head_commit_id: params.head_commit_id,
            delete_branch_after_merge: params.delete_branch_after_merge,
            force_merge: params.force_merge,
            merge_when_checks_succeed: params.merge_when_checks_succeed,
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
      verification: z.boolean().optional().describe("Include verification info for every commit (default true)"),
      files: z.boolean().optional().describe("Include the list of affected files for every commit (default true)"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const result = await client.get(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}/commits`,
          {
            verification: params.verification,
            files: params.files,
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
      skip_to: zFilePath.optional().describe("Skip to the given file path"),
      whitespace: z.enum(["ignore-all", "ignore-change", "ignore-eol", "show-all"]).optional().describe("Whitespace behavior"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const result = await client.get(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}/files`,
          {
            "skip-to": params.skip_to,
            whitespace: params.whitespace,
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
      event: zCreateReviewEvent.describe("Review event: APPROVED, REQUEST_CHANGES, COMMENT, or PENDING (draft review to submit later with submit_pr_review)"),
      commit_id: zSha.optional().describe("Commit SHA the review applies to (defaults to the PR head)"),
      comments: z.array(z.object({
        path: z.string(),
        body: z.string(),
        new_position: z.number().optional().describe("Line number in the new file, or 0"),
        old_position: z.number().optional().describe("Line number in the old file, or 0"),
        extra_lines_count: z.number().optional().describe("Number of additional lines after the commented line"),
      })).optional().describe("Inline comments on specific files"),
    },
    async (params) => {
      try {
        const result = await client.post(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}/reviews`,
          {
            body: params.body,
            event: params.event,
            commit_id: params.commit_id,
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
      reviewers: z.array(z.string()).optional().describe("Usernames of requested reviewers"),
      team_reviewers: z.array(z.string()).optional().describe("Team names of requested reviewers"),
    },
    async (params) => {
      try {
        const result = await client.post(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}/requested_reviewers`,
          {
            reviewers: params.reviewers,
            team_reviewers: params.team_reviewers,
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
    "Update a pull request branch with the latest changes from the base branch (merge or rebase)",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      style: z.enum(["merge", "rebase"]).optional().describe("How to update the branch: merge (default) or rebase"),
    },
    async (params) => {
      try {
        const result = await client.post(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}/update`,
          undefined,
          { style: params.style }
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 13. Get pull request patch
  server.tool(
    "get_pr_patch",
    "Get the patch (git format-patch) of a pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      binary: z.boolean().optional().describe("Whether to include binary file changes"),
    },
    async (params) => {
      try {
        const result = await client.getRaw(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}.patch`,
          { binary: params.binary }
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 14. Check if a pull request has been merged
  server.tool(
    "is_pr_merged",
    "Check if a pull request has been merged",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
    },
    async (params) => {
      try {
        // The API answers 204 when merged and 404 when not merged
        await client.get(
          `/repos/${params.owner}/${params.repo}/pulls/${params.index}/merge`
        );
        return formatResponse({ merged: true });
      } catch (error) {
        if (error instanceof ForgejoApiError && error.status === 404) {
          return formatResponse({ merged: false });
        }
        return formatError(error);
      }
    }
  );

  // 15. cancel_pr_auto_merge
  server.tool(
    "cancel_pr_auto_merge",
    "Cancel the scheduled auto merge of a pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/pulls/${params.index}/merge`);
        return formatResponse({ message: "Scheduled auto merge cancelled successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 16. cancel_pr_review_request
  server.tool(
    "cancel_pr_review_request",
    "Cancel review requests for a pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      reviewers: z.array(z.string()).optional().describe("Usernames of reviewers to remove"),
      team_reviewers: z.array(z.string()).optional().describe("Team names of reviewers to remove"),
    },
    async (params) => {
      try {
        const { owner, repo, index, ...body } = params;
        await client.delete(`/repos/${owner}/${repo}/pulls/${index}/requested_reviewers`, body);
        return formatResponse({ message: "Review requests cancelled successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 17. get_pr_review
  server.tool(
    "get_pr_review",
    "Get a specific review of a pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      id: zId.describe("Review ID"),
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/pulls/${params.index}/reviews/${params.id}`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 18. submit_pr_review
  server.tool(
    "submit_pr_review",
    "Submit a pending review on a pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      id: zId.describe("Review ID"),
      body: zBody.optional().describe("Review body/comment"),
      event: zReviewEvent.describe("Review event: APPROVED, REQUEST_CHANGES, or COMMENT"),
    },
    async (params) => {
      try {
        const { owner, repo, index, id, ...body } = params;
        const result = await client.post(`/repos/${owner}/${repo}/pulls/${index}/reviews/${id}`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 19. delete_pr_review
  server.tool(
    "delete_pr_review",
    "Delete a specific review from a pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      id: zId.describe("Review ID"),
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/pulls/${params.index}/reviews/${params.id}`);
        return formatResponse({ message: "Review deleted successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 20. list_pr_review_comments
  server.tool(
    "list_pr_review_comments",
    "List the comments of a pull request review",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      id: zId.describe("Review ID"),
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/pulls/${params.index}/reviews/${params.id}/comments`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 21. create_pr_review_comment
  server.tool(
    "create_pr_review_comment",
    "Add a new inline comment to a pull request review",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      id: zId.describe("Review ID"),
      path: zFilePath.describe("Path of the file to comment on"),
      body: zBody.describe("Comment body"),
      new_position: z.number().int().min(0).optional().describe("Line number in the new file, or 0"),
      old_position: z.number().int().min(0).optional().describe("Line number in the old file, or 0"),
      extra_lines_count: z.number().int().min(0).optional().describe("Number of additional lines after the commented line (0 = single line comment)"),
    },
    async (params) => {
      try {
        const { owner, repo, index, id, ...body } = params;
        const result = await client.post(`/repos/${owner}/${repo}/pulls/${index}/reviews/${id}/comments`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 22. get_pr_review_comment
  server.tool(
    "get_pr_review_comment",
    "Get a single comment of a pull request review",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      id: zId.describe("Review ID"),
      comment: zId.describe("Comment ID"),
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/pulls/${params.index}/reviews/${params.id}/comments/${params.comment}`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 23. delete_pr_review_comment
  server.tool(
    "delete_pr_review_comment",
    "Delete a comment from a pull request review",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      id: zId.describe("Review ID"),
      comment: zId.describe("Comment ID"),
    },
    async (params) => {
      try {
        await client.delete(`/repos/${params.owner}/${params.repo}/pulls/${params.index}/reviews/${params.id}/comments/${params.comment}`);
        return formatResponse({ message: "Review comment deleted successfully" });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 24. dismiss_pr_review
  server.tool(
    "dismiss_pr_review",
    "Dismiss a review of a pull request",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      id: zId.describe("Review ID"),
      message: zBody.optional().describe("Reason for dismissing the review"),
      priors: z.boolean().optional().describe("Also dismiss prior reviews by the same reviewer"),
    },
    async (params) => {
      try {
        const { owner, repo, index, id, ...body } = params;
        const result = await client.post(`/repos/${owner}/${repo}/pulls/${index}/reviews/${id}/dismissals`, body);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 25. undismiss_pr_review
  server.tool(
    "undismiss_pr_review",
    "Cancel the dismissal of a pull request review",
    {
      owner: zOwner,
      repo: zRepo,
      index: zIndex.describe("Pull request number"),
      id: zId.describe("Review ID"),
    },
    async (params) => {
      try {
        const result = await client.post(`/repos/${params.owner}/${params.repo}/pulls/${params.index}/reviews/${params.id}/undismissals`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 26. Get a pull request by base and head
  server.tool(
    "get_pr_by_base_head",
    "Get a pull request by its base and head branches",
    {
      owner: zOwner,
      repo: zRepo,
      base: zBranch.describe("Base (target) branch"),
      head: zBranch.describe("Head (source) branch, or 'owner:branch' for a pull request from a fork"),
    },
    async (params) => {
      try {
        const result = await client.get(
          `/repos/${params.owner}/${params.repo}/pulls/${encodeURIComponent(params.base)}/${encodeURIComponent(params.head)}`
        );
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 27. list_pinned_pull_requests
  server.tool(
    "list_pinned_pull_requests",
    "List a repository's pinned pull requests",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/pulls/pinned`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // 28. get_commit_pull_request
  server.tool(
    "get_commit_pull_request",
    "Get the pull request associated with a commit",
    {
      owner: zOwner,
      repo: zRepo,
      sha: zSha.describe("Commit SHA"),
    },
    async (params) => {
      try {
        const result = await client.get(`/repos/${params.owner}/${params.repo}/commits/${params.sha}/pull`);
        return formatResponse(result);
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
