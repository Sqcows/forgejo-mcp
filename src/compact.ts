import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsRequestSchema, type ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { zLimit, zOwner, zPage, zRepo } from "./validation.js";

/**
 * Trims the tools/list payload so clients spend less context on tool
 * definitions. Input is still validated server-side against the full Zod
 * schemas, so nothing here weakens validation; it only removes detail the
 * model does not need in order to call a tool.
 */

// Validation-only keywords: a bad value is still rejected by the handler's Zod schema
const DROPPED_KEYWORDS = new Set(["$schema", "additionalProperties", "pattern", "minLength", "maxLength"]);

// Descriptions that say nothing the parameter's name and type do not. Only
// these exact texts are dropped, because the same name can carry real
// information elsewhere: the quota tools' `limit` is a size in bytes, and
// search_issues' `owner` is an optional filter.
const BOILERPLATE_DESCRIPTIONS = new Map<string, ReadonlySet<unknown>>([
  ["owner", new Set([zOwner.description])],
  ["repo", new Set([zRepo.description])],
  ["org", new Set([zOwner.description, "Organization name", "Name of the organization"])],
  ["page", new Set([zPage.description])],
  ["limit", new Set([zLimit.description])],
]);

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Resolve a local JSON pointer such as "#/properties/owner" against the tool's schema */
function resolvePointer(root: unknown, ref: string): unknown {
  if (!ref.startsWith("#/")) {
    return undefined;
  }
  let node = root;
  for (const key of ref.slice(2).split("/")) {
    if (node === null || typeof node !== "object") {
      return undefined;
    }
    node = (node as JsonObject)[key];
  }
  return node;
}

function compactSchema(node: unknown, root: unknown, resolving: ReadonlySet<string> = new Set()): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => compactSchema(item, root, resolving));
  }
  if (!isObject(node)) {
    return node;
  }

  // A Zod schema used twice in one tool is emitted once and then pointed to
  // ("$ref": "#/properties/base"). Inline the target so every parameter states
  // its own type: not every client resolves pointers, and the pointer is
  // usually longer than the schema it names. Recursive pointers are left alone.
  const ref = node.$ref;
  if (typeof ref === "string" && !resolving.has(ref)) {
    const target = resolvePointer(root, ref);
    if (isObject(target)) {
      // The pointing parameter's own keywords (its description) win over the target's
      const own = { ...node };
      delete own.$ref;
      return compactSchema({ ...target, ...own }, root, new Set(resolving).add(ref));
    }
  }

  const result: JsonObject = {};
  for (const [key, value] of Object.entries(node)) {
    if (DROPPED_KEYWORDS.has(key) && typeof value !== "object") {
      continue;
    }
    if (key === "properties" && isObject(value)) {
      // Property names are data, not schema keywords, so only their values are compacted
      const properties: JsonObject = {};
      for (const [name, schema] of Object.entries(value)) {
        const compacted = compactSchema(schema, root, resolving);
        if (isObject(compacted) && BOILERPLATE_DESCRIPTIONS.get(name)?.has(compacted.description)) {
          delete compacted.description;
        }
        properties[name] = compacted;
      }
      result[key] = properties;
      continue;
    }
    result[key] = compactSchema(value, root, resolving);
  }
  return result;
}

export function compactToolList(result: ListToolsResult): ListToolsResult {
  return {
    ...result,
    tools: result.tools.map((tool) => {
      const compacted: Record<string, unknown> = {
        ...tool,
        inputSchema: compactSchema(tool.inputSchema, tool.inputSchema),
      };
      // Every tool here is a plain synchronous call; "forbidden" is the protocol default
      delete compacted.execution;
      return compacted as ListToolsResult["tools"][number];
    }),
  };
}

type ListToolsHandler = (request: unknown, extra: unknown) => Promise<ListToolsResult>;

// Compacted lists by the set of enabled areas. Tools are only registered at
// startup, so the list for a given set never changes, while the SDK re-derives
// every tool's JSON Schema on each tools/list call. In HTTP mode, where each
// session has its own server, this makes every list after the first free.
const cache = new Map<string, Promise<ListToolsResult>>();

/**
 * Wraps the SDK's tools/list handler so its output is compacted and computed
 * once. Call after tools are registered; `cacheKey` must identify the set of
 * tools registered on this server.
 */
export function installCompactToolList(server: McpServer, cacheKey: string): void {
  // The SDK installs its tools/list handler when the first tool is registered
  // and offers no hook to post-process the result, so wrap the one it stored.
  const handlers = (server.server as unknown as { _requestHandlers: Map<string, ListToolsHandler> })._requestHandlers;
  const original = handlers?.get("tools/list");
  if (!original) {
    return;
  }
  server.server.setRequestHandler(ListToolsRequestSchema, (request, extra) => {
    let result = cache.get(cacheKey);
    if (!result) {
      result = original(request, extra).then(compactToolList);
      // Do not remember a failure
      result.catch(() => cache.delete(cacheKey));
      cache.set(cacheKey, result);
    }
    return result;
  });
}
