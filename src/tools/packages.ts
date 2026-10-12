import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient } from "../client.js";
import { formatResponse, formatError } from "./helpers.js";
import { zOwner, zRepo, zPage, zLimit, zSearchQuery } from "../validation.js";

const zPackageType = z.enum([
  "alpine", "cargo", "chef", "composer", "conan", "conda", "container", "cran", "debian", "generic", "go",
  "helm", "maven", "npm", "nuget", "pub", "pypi", "rpm", "rubygems", "swift", "vagrant",
]);

// Package names and versions may contain characters such as "@" and "/" (e.g. scoped
// npm packages), so they are URL-encoded into a single path segment by the tools.
const zPackageName = z
  .string()
  .min(1)
  .max(255)
  .refine((val) => !val.includes("..") && !val.includes("\\"), "Must not contain '..' or backslashes");

const zPackageVersion = zPackageName;

export function registerPackageTools(server: McpServer, client: ForgejoClient): void {
  // 1. list_packages
  server.tool(
    "list_packages",
    "List all packages of an owner (user or organization)",
    {
      owner: zOwner.describe("Owner of the packages"),
      type: zPackageType.optional().describe("Package type filter"),
      q: zSearchQuery.optional().describe("Name filter"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/packages/${params.owner}`, {
          type: params.type,
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

  // 2. get_package
  server.tool(
    "get_package",
    "Get a specific version of a package",
    {
      owner: zOwner.describe("Owner of the package"),
      type: zPackageType.describe("Type of the package"),
      name: zPackageName.describe("Name of the package"),
      version: zPackageVersion.describe("Version of the package"),
    },
    async (params) => {
      try {
        const data = await client.get(
          `/packages/${params.owner}/${params.type}/${encodeURIComponent(params.name)}/${encodeURIComponent(params.version)}`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 3. delete_package
  server.tool(
    "delete_package",
    "Delete a specific version of a package",
    {
      owner: zOwner.describe("Owner of the package"),
      type: zPackageType.describe("Type of the package"),
      name: zPackageName.describe("Name of the package"),
      version: zPackageVersion.describe("Version of the package"),
    },
    async (params) => {
      try {
        const data = await client.delete(
          `/packages/${params.owner}/${params.type}/${encodeURIComponent(params.name)}/${encodeURIComponent(params.version)}`
        );
        return formatResponse(data ?? "Package deleted successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 4. list_package_files
  server.tool(
    "list_package_files",
    "List all files of a specific version of a package",
    {
      owner: zOwner.describe("Owner of the package"),
      type: zPackageType.describe("Type of the package"),
      name: zPackageName.describe("Name of the package"),
      version: zPackageVersion.describe("Version of the package"),
    },
    async (params) => {
      try {
        const data = await client.get(
          `/packages/${params.owner}/${params.type}/${encodeURIComponent(params.name)}/${encodeURIComponent(params.version)}/files`
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 5. link_package
  server.tool(
    "link_package",
    "Link a package to a repository of the same owner",
    {
      owner: zOwner.describe("Owner of the package"),
      type: zPackageType.describe("Type of the package"),
      name: zPackageName.describe("Name of the package"),
      repo_name: zRepo.describe("Name of the repository to link"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/packages/${params.owner}/${params.type}/${encodeURIComponent(params.name)}/-/link/${params.repo_name}`
        );
        return formatResponse(data ?? "Package linked successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 6. unlink_package
  server.tool(
    "unlink_package",
    "Unlink a package from its repository",
    {
      owner: zOwner.describe("Owner of the package"),
      type: zPackageType.describe("Type of the package"),
      name: zPackageName.describe("Name of the package"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/packages/${params.owner}/${params.type}/${encodeURIComponent(params.name)}/-/unlink`
        );
        return formatResponse(data ?? "Package unlinked successfully");
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
