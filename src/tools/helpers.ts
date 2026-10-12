import { ForgejoApiError } from "../client.js";
import type { ForgejoClient } from "../client.js";

export type ToolHandler<TInput, TOutput> = (
  client: ForgejoClient,
  input: TInput
) => Promise<TOutput>;

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
