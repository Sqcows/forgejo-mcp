import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient } from "../client.js";
import { formatResponse, formatError } from "./helpers.js";
import { zOwner, zRepo, zBranch, zFilePath, zPage, zLimit, zTitle, zBody, zSha, zSearchQuery } from "../validation.js";

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
          `/repos/${params.owner}/${params.repo}/branches/${params.branch}`
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
          `/repos/${params.owner}/${params.repo}/branches/${params.branch}`
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
          `/repos/${params.owner}/${params.repo}/contents/${params.filepath}`,
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
          `/repos/${params.owner}/${params.repo}/contents/${params.filepath}`,
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
          `/repos/${params.owner}/${params.repo}/contents/${params.filepath}`,
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
          `/repos/${params.owner}/${params.repo}/contents/${params.filepath}`,
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
}
