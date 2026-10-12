import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient } from "./client.js";
import { installCompactToolList } from "./compact.js";
import type { ForgejoConfig, ToolArea } from "./config.js";
import { registerRepositoryTools } from "./tools/repository.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerPullRequestTools } from "./tools/pullrequests.js";
import { registerOrganizationTools } from "./tools/organizations.js";
import { registerUserTools } from "./tools/users.js";
import { registerAdminTools } from "./tools/admin.js";
import { registerRepoSettingsTools } from "./tools/repo-settings.js";
import { registerActionsTools } from "./tools/actions.js";
import { registerPackageTools } from "./tools/packages.js";

/**
 * Read the version from package.json at runtime so the server version never
 * drifts from the published package version. Resolves relative to this module,
 * which sits one level below the package root both in src/ (tsx) and dist/.
 */
function resolveVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const SERVER_VERSION = resolveVersion();

interface ToolGroup {
  area: ToolArea;
  label: string;
  register: (server: McpServer, client: ForgejoClient) => void;
  summary: string;
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    area: "repository",
    label: "Repository",
    register: registerRepositoryTools,
    summary: "repositories, branches, files and multi-file commits, commits and statuses, releases, tags, git data, collaborators, topics",
  },
  {
    area: "repo-settings",
    label: "Repository Settings",
    register: registerRepoSettingsTools,
    summary: "webhooks, branch and tag protections, deploy keys, mirrors, wiki pages, migration, templates, fork sync, transfers, flags",
  },
  {
    area: "issues",
    label: "Issues",
    register: registerIssueTools,
    summary: "issues, comments, labels, milestones, reactions, dependencies, pins, deadlines, tracked time, subscriptions, attachments",
  },
  {
    area: "pull-requests",
    label: "Pull Requests",
    register: registerPullRequestTools,
    summary: "pull requests, merging, diffs and patches, reviews and review comments",
  },
  {
    area: "organizations",
    label: "Organizations",
    register: registerOrganizationTools,
    summary: "organizations, members, teams, organization labels and webhooks, blocking, quota",
  },
  {
    area: "users",
    label: "Users",
    register: registerUserTools,
    summary: "user profiles, followers, stars, watches, emails, SSH and GPG keys, webhooks, settings, notifications",
  },
  {
    area: "actions",
    label: "Actions",
    register: registerActionsTools,
    summary: "workflow runs, jobs and logs, artifacts, workflow dispatch, secrets, variables, runners",
  },
  {
    area: "packages",
    label: "Packages",
    register: registerPackageTools,
    summary: "package registry",
  },
  {
    area: "admin",
    label: "Admin",
    register: registerAdminTools,
    summary: "user administration, system webhooks, cron, quota, unadopted repositories, instance settings, markdown rendering, gitignore/license/label templates",
  },
];

function buildInstructions(groups: ToolGroup[]): string {
  return `This MCP server connects to a Forgejo (or Gitea) instance and provides tools to interact with its API.

## Tool categories

${groups.map((group) => `- **${group.label}**: ${group.summary}`).join("\n")}

## Conventions

- Most tools require \`owner\` and \`repo\` parameters to identify a repository.
- List endpoints support pagination with \`page\` (starting at 1) and \`limit\` (1–50) parameters.
- Tool names use snake_case with a domain prefix for admin tools (e.g. \`admin_list_users\`).
- Tools for the authenticated user contain \`my\` (e.g. \`list_my_ssh_keys\`); organization-scoped tools contain \`org\`.
- File content parameters (create_file, update_file, change_files, create_wiki_page) expect base64-encoded content.
- \`check_*\` tools return "Success" when the condition holds and a 404 error when it does not.
- The server returns JSON responses from the Forgejo API, or error messages with HTTP status codes on failure.
`;
}

export function createServer(config: ForgejoConfig): McpServer {
  const disabled = new Set(config.disabledAreas ?? []);
  const groups = TOOL_GROUPS.filter((group) => !disabled.has(group.area));

  const server = new McpServer(
    {
      name: "forgejo-mcp",
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        logging: {},
      },
      instructions: buildInstructions(groups),
    }
  );

  const client = new ForgejoClient(config);

  for (const group of groups) {
    group.register(server, client);
  }

  installCompactToolList(server, groups.map((group) => group.area).join(","));

  return server;
}
