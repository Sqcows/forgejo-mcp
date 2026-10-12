import { describe, it, expect } from "vitest";
import { compactToolList } from "../compact.js";

describe("compactToolList", () => {
  const tool = {
    name: "example",
    description: "Example tool",
    execution: { taskSupport: "forbidden" },
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      additionalProperties: false,
      required: ["owner"],
      properties: {
        owner: { type: "string", minLength: 1, maxLength: 255, pattern: "^[a-z]+$", description: "Owner/username" },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Number of results per page (max 50)" },
        state: { type: "string", enum: ["open", "closed"], description: "Filter by state" },
        pattern: { type: "string", description: "Glob pattern" },
        comments: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { path: { type: "string", maxLength: 10 } },
          },
        },
      },
    },
  };

  const [compacted] = compactToolList({ tools: [tool] } as any).tools as any[];

  it("drops validation-only keywords and per-tool boilerplate", () => {
    expect(compacted.execution).toBeUndefined();
    expect(compacted.inputSchema.$schema).toBeUndefined();
    expect(compacted.inputSchema.additionalProperties).toBeUndefined();
    expect(compacted.inputSchema.properties.owner).toEqual({ type: "string" });
    expect(compacted.inputSchema.properties.comments.items).toEqual({
      type: "object",
      properties: { path: { type: "string" } },
    });
  });

  it("keeps what the model needs to call the tool", () => {
    expect(compacted.name).toBe("example");
    expect(compacted.description).toBe("Example tool");
    expect(compacted.inputSchema.required).toEqual(["owner"]);
    expect(compacted.inputSchema.properties.limit).toEqual({ type: "integer", minimum: 1, maximum: 50 });
    expect(compacted.inputSchema.properties.state).toEqual({
      type: "string",
      enum: ["open", "closed"],
      description: "Filter by state",
    });
  });

  it("does not mistake a parameter named like a keyword for the keyword", () => {
    expect(compacted.inputSchema.properties.pattern).toEqual({ type: "string", description: "Glob pattern" });
  });

  it("does not mutate the original tool", () => {
    expect(tool.inputSchema.properties.owner.pattern).toBe("^[a-z]+$");
    expect(tool.execution).toBeDefined();
  });

  it("keeps a description that says more than the parameter name", () => {
    const quotaTool = {
      name: "quota",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string", description: "Only issues in repositories owned by this user or organization" },
          limit: { type: "integer", description: "The limit set by the rule, in bytes (-1 for unlimited)" },
        },
      },
    };
    const [result] = compactToolList({ tools: [quotaTool] } as any).tools as any[];

    expect(result.inputSchema.properties).toEqual(quotaTool.inputSchema.properties);
  });

  it("inlines pointers to a schema used earlier in the same tool", () => {
    const compareTool = {
      name: "compare",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string", minLength: 1, description: "Owner/username" },
          new_owner: { $ref: "#/properties/owner" },
          base: { type: "string", maxLength: 255, description: "Base branch" },
          head: { $ref: "#/properties/base", description: "Head branch" },
          files: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string", description: "File path" },
                from_path: { $ref: "#/properties/files/items/properties/path", description: "Old path" },
              },
            },
          },
          self: { $ref: "#/properties/self" },
          missing: { $ref: "#/properties/nope" },
        },
      },
    };
    const { properties } = (compactToolList({ tools: [compareTool] } as any).tools as any[])[0].inputSchema;

    expect(properties.new_owner).toEqual({ type: "string", description: "Owner/username" });
    expect(properties.head).toEqual({ type: "string", description: "Head branch" });
    expect(properties.files.items.properties.from_path).toEqual({ type: "string", description: "Old path" });
    // Pointers that cannot be resolved without looping are passed through untouched
    expect(properties.self).toEqual({ $ref: "#/properties/self" });
    expect(properties.missing).toEqual({ $ref: "#/properties/nope" });
  });
});
