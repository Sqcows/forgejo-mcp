import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient } from "../client.js";
import { formatResponse, formatError, encodePath } from "./helpers.js";
import { zOwner, zRepo, zBranch, zFilePath, zPage, zLimit, zTitle, zBody, zSha, zSearchQuery, zId, zRef, zTag } from "../validation.js";

/** Topic name: lowercase letters, digits, hyphens, and dots */
const zTopic = z
  .string()
  .min(1)
  .max(35)
  .regex(/^[a-z0-9][a-z0-9.-]*$/, "Topics must start with a letter or number and contain only lowercase letters, numbers, hyphens, and dots")
  .describe("Topic name");

export function registerRepositoryTools(server: McpServer, client: ForgejoClient): void {
  // 1. search_repos
  server.tool(
    "search_repos",
    "Search for repositories on the Forgejo instance",
    {
      q: zSearchQuery.optional(),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/repos/search", {
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

  // 2. get_repo
  server.tool(
    "get_repo",
    "Get details of a repository by owner and name",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 3. create_repo
  server.tool(
    "create_repo",
    "Create a new repository for the authenticated user",
    {
      name: zTitle.describe("Name of the new repository"),
      description: zBody.optional(),
      private: z.boolean().optional().describe("Whether the repository is private"),
      auto_init: z.boolean().optional().describe("Initialize the repository with a README"),
      default_branch: zBranch.optional(),
    },
    async (params) => {
      try {
        const data = await client.post("/user/repos", {
          name: params.name,
          description: params.description,
          private: params.private,
          auto_init: params.auto_init,
          default_branch: params.default_branch,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 4. create_org_repo
  server.tool(
    "create_org_repo",
    "Create a new repository in an organization",
    {
      org: zOwner,
      name: zTitle.describe("Name of the new repository"),
      description: zBody.optional(),
      private: z.boolean().optional().describe("Whether the repository is private"),
      auto_init: z.boolean().optional().describe("Initialize the repository with a README"),
    },
    async (params) => {
      try {
        const data = await client.post(`/orgs/${params.org}/repos`, {
          name: params.name,
          description: params.description,
          private: params.private,
          auto_init: params.auto_init,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 5. delete_repo
  server.tool(
    "delete_repo",
    "Delete a repository by owner and name",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.delete(`/repos/${params.owner}/${params.repo}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 6. fork_repo
  server.tool(
    "fork_repo",
    "Fork a repository",
    {
      owner: zOwner,
      repo: zRepo,
      organization: zOwner.optional(),
      name: zTitle.optional().describe("Name for the forked repository"),
    },
    async (params) => {
      try {
        const data = await client.post(`/repos/${params.owner}/${params.repo}/forks`, {
          organization: params.organization,
          name: params.name,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 7. list_branches
  server.tool(
    "list_branches",
    "List branches of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/branches`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 8. get_branch
  server.tool(
    "get_branch",
    "Get details of a specific branch",
    {
      owner: zOwner,
      repo: zRepo,
      branch: zBranch,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/branches/${encodePath(params.branch)}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 9. create_branch
  server.tool(
    "create_branch",
    "Create a new branch in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      new_branch_name: zBranch,
      old_branch_name: zBranch.optional(),
    },
    async (params) => {
      try {
        const data = await client.post(`/repos/${params.owner}/${params.repo}/branches`, {
          new_branch_name: params.new_branch_name,
          old_branch_name: params.old_branch_name,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 10. delete_branch
  server.tool(
    "delete_branch",
    "Delete a branch from a repository",
    {
      owner: zOwner,
      repo: zRepo,
      branch: zBranch,
    },
    async (params) => {
      try {
        const data = await client.delete(
          `/repos/${params.owner}/${params.repo}/branches/${encodePath(params.branch)}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 11. list_repo_commits
  server.tool(
    "list_repo_commits",
    "List commits in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      sha: z.string().optional().describe("SHA or branch name to list commits from"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/commits`, {
          sha: params.sha,
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 12. get_file_contents
  server.tool(
    "get_file_contents",
    "Get the contents of a file in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      filepath: zFilePath,
      ref: z.string().max(255).optional().describe("Branch, tag, or commit SHA to get the file from"),
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/contents/${encodePath(params.filepath)}`,
          { ref: params.ref }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 13. create_file
  server.tool(
    "create_file",
    "Create a new file in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      filepath: zFilePath,
      content: z.string().max(10_485_760).describe("Base64 encoded file content"),
      message: zTitle.describe("Commit message for creating the file"),
      branch: zBranch.optional(),
      new_branch: zBranch.optional(),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/contents/${encodePath(params.filepath)}`,
          {
            content: params.content,
            message: params.message,
            branch: params.branch,
            new_branch: params.new_branch,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 14. update_file
  server.tool(
    "update_file",
    "Update an existing file in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      filepath: zFilePath,
      content: z.string().max(10_485_760).describe("Base64 encoded new file content"),
      sha: zSha.describe("Blob SHA of the existing file (for conflict detection)"),
      message: zTitle.describe("Commit message for the update"),
      branch: zBranch.optional(),
    },
    async (params) => {
      try {
        const data = await client.put(
          `/repos/${params.owner}/${params.repo}/contents/${encodePath(params.filepath)}`,
          {
            content: params.content,
            sha: params.sha,
            message: params.message,
            branch: params.branch,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 15. delete_file
  server.tool(
    "delete_file",
    "Delete a file from a repository",
    {
      owner: zOwner,
      repo: zRepo,
      filepath: zFilePath,
      sha: zSha.describe("Blob SHA of the file to delete"),
      message: zTitle.describe("Commit message for the deletion"),
      branch: zBranch.optional(),
    },
    async (params) => {
      try {
        const data = await client.request(
          "DELETE",
          `/repos/${params.owner}/${params.repo}/contents/${encodePath(params.filepath)}`,
          {
            body: {
              sha: params.sha,
              message: params.message,
              branch: params.branch,
            },
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 16. list_releases
  server.tool(
    "list_releases",
    "List releases of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/releases`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 17. create_release
  server.tool(
    "create_release",
    "Create a new release for a repository",
    {
      owner: zOwner,
      repo: zRepo,
      tag_name: z.string().max(255).describe("Tag name for the release"),
      name: zTitle.optional().describe("Title of the release"),
      body: zBody.optional(),
      draft: z.boolean().optional().describe("Whether this is a draft release"),
      prerelease: z.boolean().optional().describe("Whether this is a pre-release"),
      target_commitish: z.string().max(255).optional().describe("Branch or commit SHA to tag"),
    },
    async (params) => {
      try {
        const data = await client.post(`/repos/${params.owner}/${params.repo}/releases`, {
          tag_name: params.tag_name,
          name: params.name,
          body: params.body,
          draft: params.draft,
          prerelease: params.prerelease,
          target_commitish: params.target_commitish,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 18. list_tags
  server.tool(
    "list_tags",
    "List tags of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/tags`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 19. list_repo_topics
  server.tool(
    "list_repo_topics",
    "Get the list of topics for a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/topics`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 20. update_repo_topics
  server.tool(
    "update_repo_topics",
    "Set the topics for a repository (replaces all existing topics)",
    {
      owner: zOwner,
      repo: zRepo,
      topics: z.array(z.string()).describe("List of topic names to set"),
    },
    async (params) => {
      try {
        const data = await client.put(`/repos/${params.owner}/${params.repo}/topics`, {
          topics: params.topics,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 21. list_forks
  server.tool(
    "list_forks",
    "List forks of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/forks`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 22. list_collaborators
  server.tool(
    "list_collaborators",
    "List collaborators of a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/collaborators`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 23. add_collaborator
  server.tool(
    "add_collaborator",
    "Add a collaborator to a repository",
    {
      owner: zOwner,
      repo: zRepo,
      collaborator: zOwner,
      permission: z.enum(["read", "write", "admin"]).optional(),
    },
    async (params) => {
      try {
        const data = await client.put(
          `/repos/${params.owner}/${params.repo}/collaborators/${params.collaborator}`,
          { permission: params.permission }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 24. edit_repo
  server.tool(
    "edit_repo",
    "Edit a repository's settings",
    {
      owner: zOwner,
      repo: zRepo,
      name: zTitle.optional().describe("New name for the repository"),
      description: zBody.optional(),
      website: z.string().max(1024).optional().describe("Website URL for the repository"),
      default_branch: zBranch.optional(),
      private: z.boolean().optional().describe("Whether the repository is private"),
      archived: z.boolean().optional().describe("Whether the repository is archived"),
      has_issues: z.boolean().optional().describe("Whether the issue tracker is enabled"),
      has_pull_requests: z.boolean().optional().describe("Whether pull requests are enabled"),
      has_wiki: z.boolean().optional().describe("Whether the wiki is enabled"),
      has_projects: z.boolean().optional().describe("Whether projects are enabled"),
      has_releases: z.boolean().optional().describe("Whether releases are enabled"),
      has_packages: z.boolean().optional().describe("Whether packages are enabled"),
      has_actions: z.boolean().optional().describe("Whether actions are enabled"),
      allow_merge_commits: z.boolean().optional().describe("Allow merge commits"),
      allow_rebase: z.boolean().optional().describe("Allow rebase merges"),
      allow_rebase_explicit: z.boolean().optional().describe("Allow rebase with merge commits"),
      allow_squash_merge: z.boolean().optional().describe("Allow squash merges"),
      ignore_whitespace_conflicts: z.boolean().optional().describe("Ignore whitespace in conflicts"),
    },
    async (params) => {
      try {
        const { owner, repo, ...body } = params;
        const data = await client.patch(`/repos/${owner}/${repo}`, body);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 25. transfer_repo
  server.tool(
    "transfer_repo",
    "Transfer a repository to a new owner",
    {
      owner: zOwner,
      repo: zRepo,
      new_owner: zOwner,
      team_ids: z
        .array(z.number())
        .optional()
        .describe("Team IDs to add to the repository after transfer"),
    },
    async (params) => {
      try {
        const data = await client.post(`/repos/${params.owner}/${params.repo}/transfer`, {
          new_owner: params.new_owner,
          team_ids: params.team_ids,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 26. get_release
  server.tool(
    "get_release",
    "Get a release by ID",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Release ID"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/releases/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 27. get_latest_release
  server.tool(
    "get_latest_release",
    "Get the most recent non-prerelease, non-draft release of a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/releases/latest`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 28. get_release_by_tag
  server.tool(
    "get_release_by_tag",
    "Get a release by tag name",
    {
      owner: zOwner,
      repo: zRepo,
      tag: zTag,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/releases/tags/${encodePath(params.tag)}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 29. edit_release
  server.tool(
    "edit_release",
    "Update a release",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Release ID"),
      tag_name: zTag.optional().describe("Tag name"),
      name: zTitle.optional().describe("Release title"),
      body: zBody.optional().describe("Release notes"),
      target_commitish: zRef.optional().describe("Branch or commit SHA the tag is created from"),
      draft: z.boolean().optional().describe("Whether the release is a draft"),
      prerelease: z.boolean().optional().describe("Whether the release is a pre-release"),
      hide_archive_links: z.boolean().optional().describe("Hide the auto-generated source archive links"),
    },
    async (params) => {
      try {
        const data = await client.patch(`/repos/${params.owner}/${params.repo}/releases/${params.id}`, {
          tag_name: params.tag_name,
          name: params.name,
          body: params.body,
          target_commitish: params.target_commitish,
          draft: params.draft,
          prerelease: params.prerelease,
          hide_archive_links: params.hide_archive_links,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 30. delete_release
  server.tool(
    "delete_release",
    "Delete a release by ID",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Release ID"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/repos/${params.owner}/${params.repo}/releases/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 31. delete_release_by_tag
  server.tool(
    "delete_release_by_tag",
    "Delete a release by tag name",
    {
      owner: zOwner,
      repo: zRepo,
      tag: zTag,
    },
    async (params) => {
      try {
        const data = await client.delete(`/repos/${params.owner}/${params.repo}/releases/tags/${encodePath(params.tag)}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 32. list_release_assets
  server.tool(
    "list_release_assets",
    "List the attachments of a release",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Release ID"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/releases/${params.id}/assets`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 33. get_release_asset
  server.tool(
    "get_release_asset",
    "Get a release attachment",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Release ID"),
      attachment_id: zId.describe("Attachment ID"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/releases/${params.id}/assets/${params.attachment_id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 34. edit_release_asset
  server.tool(
    "edit_release_asset",
    "Edit a release attachment",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Release ID"),
      attachment_id: zId.describe("Attachment ID"),
      name: zTitle.optional().describe("New attachment name"),
      browser_download_url: z.string().url().max(2048).optional().describe("New URL (external attachments only)"),
    },
    async (params) => {
      try {
        const data = await client.patch(`/repos/${params.owner}/${params.repo}/releases/${params.id}/assets/${params.attachment_id}`, {
          name: params.name,
          browser_download_url: params.browser_download_url,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 35. delete_release_asset
  server.tool(
    "delete_release_asset",
    "Delete a release attachment",
    {
      owner: zOwner,
      repo: zRepo,
      id: zId.describe("Release ID"),
      attachment_id: zId.describe("Attachment ID"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/repos/${params.owner}/${params.repo}/releases/${params.id}/assets/${params.attachment_id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 36. create_tag
  server.tool(
    "create_tag",
    "Create a new git tag in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      tag_name: zTag,
      target: zRef.optional().describe("Branch or commit SHA to tag (defaults to the default branch)"),
      message: zBody.optional().describe("Tag message (creates an annotated tag)"),
    },
    async (params) => {
      try {
        const data = await client.post(`/repos/${params.owner}/${params.repo}/tags`, {
          tag_name: params.tag_name,
          target: params.target,
          message: params.message,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 37. get_tag
  server.tool(
    "get_tag",
    "Get a tag of a repository by tag name",
    {
      owner: zOwner,
      repo: zRepo,
      tag: zTag,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/tags/${encodePath(params.tag)}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 38. delete_tag
  server.tool(
    "delete_tag",
    "Delete a repository's tag by name",
    {
      owner: zOwner,
      repo: zRepo,
      tag: zTag,
    },
    async (params) => {
      try {
        const data = await client.delete(`/repos/${params.owner}/${params.repo}/tags/${encodePath(params.tag)}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 39. get_commit
  server.tool(
    "get_commit",
    "Get a single commit from a repository",
    {
      owner: zOwner,
      repo: zRepo,
      sha: zRef.describe("Commit SHA or git ref"),
      stat: z.boolean().optional().describe("Include diff stats (default true)"),
      verification: z.boolean().optional().describe("Include signature verification (default true)"),
      files: z.boolean().optional().describe("Include the list of affected files (default true)"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/git/commits/${encodePath(params.sha)}`, { stat: params.stat, verification: params.verification, files: params.files });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 40. get_commit_diff
  server.tool(
    "get_commit_diff",
    "Get the diff or patch of a commit",
    {
      owner: zOwner,
      repo: zRepo,
      sha: zSha.describe("Commit SHA"),
      diff_type: z.enum(["diff", "patch"]).default("diff").describe("Output format: diff or patch"),
    },
    async (params) => {
      try {
        const data = await client.getRaw(`/repos/${params.owner}/${params.repo}/git/commits/${params.sha}.${params.diff_type}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 41. compare_commits
  server.tool(
    "compare_commits",
    "Compare two branches, tags, or commits",
    {
      owner: zOwner,
      repo: zRepo,
      base: zRef.describe("Base branch, tag, or commit SHA"),
      head: zRef.describe("Head branch, tag, or commit SHA"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/compare/${encodePath(params.base)}...${encodePath(params.head)}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 42. get_combined_commit_status
  server.tool(
    "get_combined_commit_status",
    "Get the combined status of a commit by branch, tag, or commit SHA",
    {
      owner: zOwner,
      repo: zRepo,
      ref: zRef,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/commits/${encodePath(params.ref)}/status`, { page: params.page, limit: params.limit });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 43. list_commit_statuses_by_ref
  server.tool(
    "list_commit_statuses_by_ref",
    "List the statuses of a commit by branch, tag, or commit SHA",
    {
      owner: zOwner,
      repo: zRepo,
      ref: zRef,
      sort: z.enum(["oldest", "recentupdate", "leastupdate", "leastindex", "highestindex"]).optional().describe("Sort order"),
      state: z.enum(["pending", "success", "error", "failure", "warning"]).optional().describe("Filter by state"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/commits/${encodePath(params.ref)}/statuses`, { sort: params.sort, state: params.state, page: params.page, limit: params.limit });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 44. list_commit_statuses
  server.tool(
    "list_commit_statuses",
    "List the statuses of a commit by SHA",
    {
      owner: zOwner,
      repo: zRepo,
      sha: zSha.describe("Commit SHA"),
      sort: z.enum(["oldest", "recentupdate", "leastupdate", "leastindex", "highestindex"]).optional().describe("Sort order"),
      state: z.enum(["pending", "success", "error", "failure", "warning"]).optional().describe("Filter by state"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/statuses/${params.sha}`, { sort: params.sort, state: params.state, page: params.page, limit: params.limit });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 45. create_commit_status
  server.tool(
    "create_commit_status",
    "Create a commit status (e.g. to report a CI result)",
    {
      owner: zOwner,
      repo: zRepo,
      sha: zSha.describe("Commit SHA"),
      state: z.enum(["pending", "success", "error", "failure", "warning"]).describe("Status state"),
      context: zTitle.optional().describe("Label identifying the source of the status"),
      description: zBody.optional().describe("Short description of the status"),
      target_url: z.string().url().max(2048).optional().describe("URL with more details"),
    },
    async (params) => {
      try {
        const data = await client.post(`/repos/${params.owner}/${params.repo}/statuses/${params.sha}`, {
          state: params.state,
          context: params.context,
          description: params.description,
          target_url: params.target_url,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 46. list_repo_contents
  server.tool(
    "list_repo_contents",
    "List the metadata of all entries in the root directory of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      ref: zRef.optional().describe("Branch, tag, or commit SHA (defaults to the default branch)"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/contents`, { ref: params.ref });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 47. change_files
  server.tool(
    "change_files",
    "Create, update, and delete multiple files in a repository in a single commit",
    {
      owner: zOwner,
      repo: zRepo,
      files: z
        .array(
          z.object({
            operation: z.enum(["create", "update", "delete"]),
            path: zFilePath,
            content: z.string().max(10_485_760).optional().describe("Base64 encoded content (create/update)"),
            sha: zSha.optional().describe("Blob SHA of the existing file (update/delete)"),
            from_path: zFilePath.optional().describe("Old path when renaming a file"),
          })
        )
        .min(1)
        .describe("File operations to perform"),
      message: zBody.optional().describe("Commit message"),
      branch: zBranch.optional().describe("Branch to commit to (defaults to the default branch)"),
      new_branch: zBranch.optional().describe("Create this branch from `branch` and commit to it"),
      force_overwrite_new_branch: z.boolean().optional().describe("Overwrite new_branch if it already exists"),
      author: z.object({ name: z.string().max(255).optional(), email: z.string().max(255).optional() }).optional(),
      committer: z.object({ name: z.string().max(255).optional(), email: z.string().max(255).optional() }).optional(),
      dates: z.object({ author: z.string().optional(), committer: z.string().optional() }).optional().describe("Author/committer dates (RFC 3339)"),
      signoff: z.boolean().optional().describe("Add a Signed-off-by trailer"),
    },
    async (params) => {
      try {
        const data = await client.post(`/repos/${params.owner}/${params.repo}/contents`, {
          files: params.files,
          message: params.message,
          branch: params.branch,
          new_branch: params.new_branch,
          force_overwrite_new_branch: params.force_overwrite_new_branch,
          author: params.author,
          committer: params.committer,
          dates: params.dates,
          signoff: params.signoff,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 48. get_raw_file
  server.tool(
    "get_raw_file",
    "Get the raw contents of a file in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      filepath: zFilePath,
      ref: zRef.optional().describe("Branch, tag, or commit SHA (defaults to the default branch)"),
    },
    async (params) => {
      try {
        const data = await client.getRaw(`/repos/${params.owner}/${params.repo}/raw/${encodePath(params.filepath)}`, { ref: params.ref });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 49. get_editorconfig
  server.tool(
    "get_editorconfig",
    "Get the EditorConfig definitions that apply to a file in a repository",
    {
      owner: zOwner,
      repo: zRepo,
      filepath: zFilePath,
      ref: zRef.optional().describe("Branch, tag, or commit SHA (defaults to the default branch)"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/editorconfig/${encodePath(params.filepath)}`, { ref: params.ref });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 50. apply_diff_patch
  server.tool(
    "apply_diff_patch",
    "Apply a diff patch to a repository as a new commit",
    {
      owner: zOwner,
      repo: zRepo,
      content: z.string().max(10_485_760).describe("The diff/patch to apply"),
      sha: zSha.optional().describe("Blob SHA (listed by the API spec; not needed when applying a patch)"),
      message: zBody.optional().describe("Commit message"),
      branch: zBranch.optional().describe("Branch to commit to (defaults to the default branch)"),
      new_branch: zBranch.optional().describe("Create this branch from `branch` and commit to it"),
      force_overwrite_new_branch: z.boolean().optional().describe("Overwrite new_branch if it already exists"),
      author: z.object({ name: z.string().max(255).optional(), email: z.string().max(255).optional() }).optional(),
      committer: z.object({ name: z.string().max(255).optional(), email: z.string().max(255).optional() }).optional(),
      dates: z.object({ author: z.string().optional(), committer: z.string().optional() }).optional().describe("Author/committer dates (RFC 3339)"),
      signoff: z.boolean().optional().describe("Add a Signed-off-by trailer"),
    },
    async (params) => {
      try {
        const data = await client.post(`/repos/${params.owner}/${params.repo}/diffpatch`, {
          content: params.content,
          sha: params.sha,
          message: params.message,
          branch: params.branch,
          new_branch: params.new_branch,
          force_overwrite_new_branch: params.force_overwrite_new_branch,
          author: params.author,
          committer: params.committer,
          dates: params.dates,
          signoff: params.signoff,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 51. get_git_tree
  server.tool(
    "get_git_tree",
    "Get the git tree of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      sha: zRef.describe("Tree or commit SHA, or a branch/tag name"),
      recursive: z.boolean().optional().describe("Include all subdirectories and files"),
      page: zPage,
      per_page: z.number().int().min(1).max(1000).optional().describe("Number of items per page"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/git/trees/${encodePath(params.sha)}`, { recursive: params.recursive, page: params.page, per_page: params.per_page });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 52. get_git_blob
  server.tool(
    "get_git_blob",
    "Get a git blob (base64 encoded) of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      sha: zSha.describe("Blob SHA"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/git/blobs/${params.sha}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 53. get_git_blobs
  server.tool(
    "get_git_blobs",
    "Get multiple git blobs of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      shas: z.array(zSha).min(1).max(30).describe("Blob SHAs"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/git/blobs`, { shas: params.shas.join(",") });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 54. list_git_refs
  server.tool(
    "list_git_refs",
    "List all git refs of a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/git/refs`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 55. get_git_ref
  server.tool(
    "get_git_ref",
    "Get git refs matching a full or partial ref name (e.g. heads/main, tags/v1.0)",
    {
      owner: zOwner,
      repo: zRepo,
      ref: zRef.describe("Full or partial ref name, without the leading refs/"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/git/refs/${encodePath(params.ref)}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 56. get_annotated_tag
  server.tool(
    "get_annotated_tag",
    "Get the tag object of an annotated tag",
    {
      owner: zOwner,
      repo: zRepo,
      sha: zSha.describe("SHA of the annotated tag object"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/git/tags/${params.sha}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 57. get_commit_note
  server.tool(
    "get_commit_note",
    "Get the git note attached to a commit",
    {
      owner: zOwner,
      repo: zRepo,
      sha: zRef.describe("Commit SHA or git ref"),
      verification: z.boolean().optional().describe("Include signature verification (default true)"),
      files: z.boolean().optional().describe("Include the list of affected files (default true)"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/git/notes/${encodePath(params.sha)}`, { verification: params.verification, files: params.files });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 58. set_commit_note
  server.tool(
    "set_commit_note",
    "Set the git note attached to a commit",
    {
      owner: zOwner,
      repo: zRepo,
      sha: zRef.describe("Commit SHA or git ref"),
      message: zBody.describe("Note content"),
    },
    async (params) => {
      try {
        const data = await client.post(`/repos/${params.owner}/${params.repo}/git/notes/${encodePath(params.sha)}`, {
          message: params.message,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 59. delete_commit_note
  server.tool(
    "delete_commit_note",
    "Remove the git note attached to a commit",
    {
      owner: zOwner,
      repo: zRepo,
      sha: zRef.describe("Commit SHA or git ref"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/repos/${params.owner}/${params.repo}/git/notes/${encodePath(params.sha)}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 60. rename_branch
  server.tool(
    "rename_branch",
    "Rename a branch",
    {
      owner: zOwner,
      repo: zRepo,
      branch: zBranch,
      name: zBranch.describe("New branch name"),
    },
    async (params) => {
      try {
        const data = await client.patch(`/repos/${params.owner}/${params.repo}/branches/${encodePath(params.branch)}`, {
          name: params.name,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 61. list_repo_languages
  server.tool(
    "list_repo_languages",
    "Get the languages of a repository and the number of bytes of code in each",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/languages`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 62. list_stargazers
  server.tool(
    "list_stargazers",
    "List the users who starred a repository",
    {
      owner: zOwner,
      repo: zRepo,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/stargazers`, { page: params.page, limit: params.limit });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 63. list_repo_watchers
  server.tool(
    "list_repo_watchers",
    "List the users watching a repository",
    {
      owner: zOwner,
      repo: zRepo,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/subscribers`, { page: params.page, limit: params.limit });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 64. get_repo_subscription
  server.tool(
    "get_repo_subscription",
    "Check if the authenticated user is watching a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/subscription`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 65. watch_repo
  server.tool(
    "watch_repo",
    "Watch a repository as the authenticated user",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.put(`/repos/${params.owner}/${params.repo}/subscription`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 66. unwatch_repo
  server.tool(
    "unwatch_repo",
    "Stop watching a repository as the authenticated user",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.delete(`/repos/${params.owner}/${params.repo}/subscription`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 67. list_repo_assignees
  server.tool(
    "list_repo_assignees",
    "List the users who can be assigned to issues in a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/assignees`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 68. list_repo_reviewers
  server.tool(
    "list_repo_reviewers",
    "List the users who can be requested to review pull requests in a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/reviewers`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 69. list_repo_activity_feeds
  server.tool(
    "list_repo_activity_feeds",
    "List a repository's activity feeds",
    {
      owner: zOwner,
      repo: zRepo,
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().describe("Only show activity on this date (YYYY-MM-DD)"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/activities/feeds`, { date: params.date, page: params.page, limit: params.limit });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 70. check_collaborator
  server.tool(
    "check_collaborator",
    "Check if a user is a collaborator of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      collaborator: zOwner.describe("Username of the collaborator"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/collaborators/${params.collaborator}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 71. remove_collaborator
  server.tool(
    "remove_collaborator",
    "Remove a collaborator from a repository",
    {
      owner: zOwner,
      repo: zRepo,
      collaborator: zOwner.describe("Username of the collaborator"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/repos/${params.owner}/${params.repo}/collaborators/${params.collaborator}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 72. get_collaborator_permission
  server.tool(
    "get_collaborator_permission",
    "Get the repository permissions of a user",
    {
      owner: zOwner,
      repo: zRepo,
      collaborator: zOwner.describe("Username of the collaborator"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/collaborators/${params.collaborator}/permission`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 73. add_repo_topic
  server.tool(
    "add_repo_topic",
    "Add a topic to a repository",
    {
      owner: zOwner,
      repo: zRepo,
      topic: zTopic,
    },
    async (params) => {
      try {
        const data = await client.put(`/repos/${params.owner}/${params.repo}/topics/${params.topic}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 74. delete_repo_topic
  server.tool(
    "delete_repo_topic",
    "Remove a topic from a repository",
    {
      owner: zOwner,
      repo: zRepo,
      topic: zTopic,
    },
    async (params) => {
      try {
        const data = await client.delete(`/repos/${params.owner}/${params.repo}/topics/${params.topic}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 75. search_topics
  server.tool(
    "search_topics",
    "Search for topics by keyword",
    {
      q: zSearchQuery.describe("Keyword to search for"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/topics/search", { q: params.q, page: params.page, limit: params.limit });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 76. get_repo_by_id
  server.tool(
    "get_repo_by_id",
    "Get a repository by its numeric ID",
    {
      id: zId.describe("Repository ID"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repositories/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 77. list_issue_templates
  server.tool(
    "list_issue_templates",
    "List the available issue templates of a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/issue_templates`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 78. get_issue_config
  server.tool(
    "get_issue_config",
    "Get the issue config of a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/issue_config`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 79. validate_issue_config
  server.tool(
    "validate_issue_config",
    "Get the validation information for the issue config of a repository",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/issue_config/validate`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
