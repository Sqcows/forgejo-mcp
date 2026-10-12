import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer } from "../server.js";

/**
 * Drives every registered tool with hostile values in every string parameter
 * and checks the request that would be sent. Whatever a parameter is allowed
 * to contain, the call must still address the endpoint the tool names: no
 * escaping the API through "..", and no smuggling a query string or fragment
 * through a path value.
 */

const BASE_URL = "https://forgejo.example.com";
const API_PREFIX = "/api/v1/";

const HOSTILE_VALUES = [
  "..",
  "../../../admin/users",
  "a/../../b",
  "%2e%2e/%2e%2e/admin",
  "..%2f..%2fadmin",
  "x?injected=1",
  "x#fragment",
  "x\\..\\y",
  "x\t../y",
];

type AnySchema = {
  safeParse: (value: unknown) => { success: boolean; data?: unknown };
  isOptional: () => boolean;
  _def: Record<string, any>;
  shape?: Record<string, AnySchema>;
};

/** A value the schema accepts. `marker` is used wherever a free-form string is allowed. */
function sample(schema: AnySchema, marker: string): unknown {
  const def = schema._def;
  if (def.typeName === "ZodEnum") return def.values[0];
  if (def.typeName === "ZodObject") return sampleObject(schema, marker);
  if (def.typeName === "ZodArray") {
    const one = [sample(def.type, marker)];
    return schema.safeParse([]).success ? [] : one;
  }
  if (def.typeName === "ZodRecord") return {};
  const candidates = [marker, 1, true, "abc123", "#abc123", "2024-01-01T00:00:00Z", "2024-01-01", "https://example.com/hook", "user@example.com"];
  for (const candidate of candidates) {
    if (schema.safeParse(candidate).success) return candidate;
  }
  const inner = def.innerType ?? def.schema;
  if (inner) return sample(inner, marker);
  throw new Error(`no sample value for ${def.typeName} ${JSON.stringify(def.checks?.map((c: any) => String(c.regex ?? c.kind)))}`);
}

function sampleObject(schema: AnySchema, marker: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema.shape ?? {})) {
    if (!field.isOptional()) result[key] = sample(field, marker);
  }
  return result;
}

describe("request path safety", () => {
  const fetched: URL[] = [];

  beforeEach(() => {
    fetched.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        fetched.push(new URL(url));
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: { get: () => "application/json" },
          text: async () => "{}",
        };
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function call(tool: any, args: unknown): Promise<URL[]> {
    fetched.length = 0;
    await tool.handler(args, {});
    return [...fetched];
  }

  it("keeps every tool on its own endpoint whatever its string parameters contain", async () => {
    const server = createServer({ baseUrl: BASE_URL, token: "test-token" });
    const tools = (server as any)._registeredTools as Record<string, any>;
    const problems: string[] = [];
    let probes = 0;

    for (const [name, tool] of Object.entries(tools)) {
      const schema = tool.inputSchema as AnySchema;
      const shape = schema.shape ?? {};

      // Required parameters only, each with a value that is unique within the call
      const base: Record<string, unknown> = {};
      const markers: Record<string, string> = {};
      Object.entries(shape).forEach(([key, field], index) => {
        // Hex digits only, so it also satisfies SHA, name, and identifier patterns
        markers[key] = `abc${1000 + index}`;
        try {
          if (!field.isOptional()) base[key] = sample(field, markers[key]);
        } catch (error) {
          throw new Error(`${name}.${key}: ${(error as Error).message}`);
        }
      });
      expect(schema.safeParse(base).success, `${name}: sample arguments should be valid`).toBe(true);

      for (const [key, field] of Object.entries(shape)) {
        const marker = markers[key];
        if (!field.safeParse(marker).success) continue; // not a free-form string

        const benign = await call(tool, schema.safeParse({ ...base, [key]: marker }).data);

        for (const hostile of HOSTILE_VALUES) {
          const parsed = schema.safeParse({ ...base, [key]: hostile });
          if (!parsed.success) continue; // refused by validation

          probes++;
          const urls = await call(tool, parsed.data);
          const where = `${name}(${key}=${JSON.stringify(hostile)})`;

          urls.forEach((url, i) => {
            if (url.origin !== BASE_URL || !url.pathname.startsWith(API_PREFIX)) {
              problems.push(`${where} left the API: ${url.href}`);
            }
            if (url.hash !== "" || url.searchParams.has("injected")) {
              problems.push(`${where} injected a query or fragment: ${url.href}`);
            }

            const expected = benign[i]?.pathname;
            if (expected === undefined) return;
            const at = expected.indexOf(marker);
            if (at === -1) {
              // The parameter is not part of the path, so the path must not move
              if (url.pathname !== expected) {
                problems.push(`${where} changed the path: ${url.pathname} (expected ${expected})`);
              }
              return;
            }
            const before = expected.slice(0, at);
            const after = expected.slice(at + marker.length);
            if (!url.pathname.startsWith(before) || !url.pathname.endsWith(after)) {
              problems.push(`${where} reached a different endpoint: ${url.pathname} (expected ${before}…${after})`);
            }
            if (hostile.includes("%") && !url.pathname.includes("%25")) {
              problems.push(`${where} sent "%" unencoded: ${url.pathname}`);
            }
          });
        }
      }
    }

    expect(problems).toEqual([]);
    // Guards against the sweep silently testing nothing
    expect(probes).toBeGreaterThan(500);
  });
});
