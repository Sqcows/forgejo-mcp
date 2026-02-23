import { ForgejoApiError } from "../client.js";
import type { ForgejoClient } from "../client.js";

export type ToolHandler<TInput, TOutput> = (
  client: ForgejoClient,
  input: TInput
) => Promise<TOutput>;

export function formatResponse(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
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
    // For unexpected errors, don't leak internals
    message = error.message;
  } else {
    message = "An unexpected error occurred";
  }

  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}
