import { ForgejoApiError } from "../client.js";
import type { ForgejoClient } from "../client.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

export type ToolHandler<TInput, TOutput> = (
  client: ForgejoClient,
  input: TInput
) => Promise<TOutput>;

/**
 * Behavioural hints (MCP ToolAnnotations) shared by the tool registrations.
 * Every field is set explicitly: an unset field falls back to the protocol
 * default (readOnly false, destructive true, idempotent false, openWorld true),
 * and clients must assume the worst about an absent hint.
 *
 * Policies:
 * - readOnlyHint is true only for tools that never modify Forgejo state: the
 *   GET/getRaw tools, plus render_markdown/render_markup, which are POSTs that
 *   only render text. A read-only tool is also idempotent by definition.
 * - destructiveHint follows the specification strictly: false only when the
 *   tool performs purely additive updates, so edits, replacements, merges and
 *   removals are destructive. Read-only tools change nothing, hence false.
 * - idempotentHint is false for every state-changing tool unless a repeated
 *   identical call is verified to have no further effect upstream; it must
 *   never be inferred from the HTTP verb alone.
 * - openWorldHint is true for every tool that talks to the Forgejo instance.
 */
export const READ_ONLY_TOOL: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export const ADDITIVE_TOOL: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

export const DESTRUCTIVE_TOOL: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

/**
 * Encode a slash-separated value (file path, branch, tag, ref) for use in a
 * request path. Each segment is percent-encoded so characters such as "#",
 * "?" and "%" address the named resource instead of being read as URL syntax,
 * while the slashes between segments are kept. Harmless "." segments are
 * dropped (so "./README.md" keeps working); ".." is rejected by the schemas.
 */
export function encodePath(value: string): string {
  return value
    .split("/")
    .filter((segment) => segment !== ".")
    .map(encodeURIComponent)
    .join("/");
}

export function formatResponse(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [
      {
        type: "text" as const,
        // Compact JSON: the reader is a model, and indentation only costs it context
        text: data == null ? "Success" : typeof data === "string" ? data : JSON.stringify(data),
      },
    ],
  };
}

export function formatError(error: unknown): { content: Array<{ type: "text"; text: string }>; isError: true } {
  let message: string;

  if (error instanceof ForgejoApiError) {
    // API errors are safe to expose (status + server message, URL is already sanitized)
    message = error.message;
  } else if (error instanceof Error) {
    // Client-side failures: a rejected path, a timeout, an oversized response,
    // or a network error. These messages name the host at most; the token is
    // only ever sent as a header, and config rejects tokens fetch would quote
    // back in an error.
    message = error.message;
  } else {
    message = "An unexpected error occurred";
  }

  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}
