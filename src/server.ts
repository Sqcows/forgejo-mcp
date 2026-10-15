import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";
import { McpServer, type RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient } from "./client.js";
import { installCompactToolList } from "./compact.js";
import type { ForgejoConfig, ToolArea } from "./config.js";
import { formatResponse } from "./tools/helpers.js";
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

/** The only tool a lazy server (--lazy) lists until an area is loaded */
export const LOAD_TOOL_AREA = "load_tool_area";

function buildInstructions(groups: ToolGroup[], lazy: boolean): string {
  // In lazy mode the areas are described by load_tool_area itself, so they
  // reach the model even through clients that do not pass instructions on
  const tools = lazy
    ? `## Loading tools

Tools are loaded on demand. At first only \`${LOAD_TOOL_AREA}\` is available: call it with the areas a task needs (its description lists them), then use the tools it adds. Loaded areas stay loaded until the server restarts.`
    : `## Tool categories

${groups.map((group) => `- **${group.label}**: ${group.summary}`).join("\n")}`;

  return `This MCP server connects to a Forgejo (or Gitea) instance and provides tools to interact with its API.

${tools}

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

/**
 * Register a group's tools and return them by name. The register functions do
 * not return what they register and the SDK keeps its tools in a private map,
 * so the group's tools are the entries that map gains.
 */
function registerGroup(server: McpServer, client: ForgejoClient, group: ToolGroup): Map<string, RegisteredTool> {
  const registry = () => (server as unknown as { _registeredTools: Record<string, RegisteredTool> })._registeredTools;
  const before = new Set(Object.keys(registry()));
  group.register(server, client);
  return new Map(Object.entries(registry()).filter(([name]) => !before.has(name)));
}

/**
 * Lazy mode: hide every tool behind load_tool_area, which switches an area's
 * tools on and tells the client its tool list changed. Only a client that
 * refetches the list when notified will see the loaded tools. Returns the
 * set of loaded areas, which grows as the model loads them.
 */
function installToolLoader(
  server: McpServer,
  groups: ToolGroup[],
  areaTools: Map<ToolArea, Map<string, RegisteredTool>>
): ReadonlySet<ToolArea> {
  // Set directly rather than through disable()/enable(): once the server is
  // connected, each of those sends its own list_changed notification
  for (const tools of areaTools.values()) {
    for (const tool of tools.values()) {
      tool.enabled = false;
    }
  }

  const loaded = new Set<ToolArea>();
  const areas = groups.map((group) => group.area) as [ToolArea, ...ToolArea[]];

  server.tool(
    LOAD_TOOL_AREA,
    "Load the tools for one or more areas of the Forgejo API. No other tools are available until their area is loaded. " +
      `Areas: ${groups.map((group) => `${group.area} (${group.summary})`).join("; ")}`,
    { areas: z.array(z.enum(areas)).min(1).describe("Areas to load") },
    async ({ areas: requested }, extra) => {
      const added = [...new Set(requested)].filter((area) => !loaded.has(area));
      if (added.length === 0) {
        return formatResponse(`Already loaded: ${requested.join(", ")}. Nothing changed.`);
      }

      const names: string[] = [];
      for (const area of added) {
        loaded.add(area);
        for (const [name, tool] of areaTools.get(area) ?? []) {
          tool.enabled = true;
          names.push(name);
        }
      }
      // Sent on this request's own stream, which in HTTP mode reaches clients
      // that keep no standalone event stream open
      await extra.sendNotification({ method: "notifications/tools/list_changed" });

      return formatResponse(
        `Loaded ${names.length} tools for ${added.join(", ")}: ${names.join(", ")}. ` +
          "The client has been told to reload its tool list. If these tools do not appear, the client does not " +
          "support loading tools mid-session; the server must be restarted without --lazy to use them."
      );
    }
  );

  return loaded;
}

export function createServer(config: ForgejoConfig): McpServer {
  const disabled = new Set(config.disabledAreas ?? []);
  const groups = TOOL_GROUPS.filter((group) => !disabled.has(group.area));
  // With every area disabled there is nothing to load, and no loader
  const lazy = config.lazy === true && groups.length > 0;

  const server = new McpServer(
    {
      name: "forgejo-mcp",
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        logging: {},
      },
      instructions: buildInstructions(groups, lazy),
    }
  );

  const client = new ForgejoClient(config);

  const areaTools = new Map<ToolArea, Map<string, RegisteredTool>>();
  for (const group of groups) {
    areaTools.set(group.area, registerGroup(server, client, group));
  }

  // The cached tool list is keyed on the tools it holds: the enabled areas,
  // plus in lazy mode the loader and whichever areas are loaded so far
  const enabled = groups.map((group) => group.area).join(",");
  if (lazy) {
    const loaded = installToolLoader(server, groups, areaTools);
    // Listed in group order, so the order areas were loaded in does not matter
    installCompactToolList(server, () => {
      const loadedAreas = groups.filter((group) => loaded.has(group.area)).map((group) => group.area);
      return `lazy:${enabled}:${loadedAreas.join(",")}`;
    });
  } else {
    installCompactToolList(server, () => enabled);
  }

  return server;
}
