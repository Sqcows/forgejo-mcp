import { DEFAULT_MAX_RESPONSE_BYTES, DEFAULT_TIMEOUT_MS, type ForgejoConfig } from "./config.js";

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ApiError {
  message: string;
  url: string;
  status: number;
}

type QueryParams = Record<string, string | number | boolean | undefined>;

// A "." or ".." path segment, including the percent-encoded spellings that URL
// parsing treats the same way. Left in, "/repos/../admin/users" would be
// resolved to a different endpoint than the one the tool meant to call.
const DOT_SEGMENT = /^(?:\.|%2e){1,2}$/i;

// Characters URL parsing would silently reinterpret in a path: "?" and "#" end
// it, a backslash becomes "/", and control characters are stripped. Tools must
// percent-encode values that can contain them (see encodePath).
// eslint-disable-next-line no-control-regex
const UNSAFE_PATH_CHARS = /[\\?#\u0000-\u001f\u007f]/;

function describeBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB` : `${bytes} bytes`;
}

export class ForgejoClient {
  private baseUrl: string;
  private token: string;
  private timeoutMs: number;
  private maxResponseBytes: number;

  constructor(config: ForgejoConfig) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxResponseBytes = config.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  }

  private get apiBase(): string {
    return `${this.baseUrl}/api/v1`;
  }

  /**
   * Build the request URL for an API path. Rejects paths that URL parsing would
   * rewrite, so a request can never reach an endpoint other than the one named.
   */
  private buildUrl(path: string, params?: QueryParams): URL {
    if (UNSAFE_PATH_CHARS.test(path) || path.split("/").some((segment) => DOT_SEGMENT.test(segment))) {
      throw new Error("Invalid request path: it contains a '.' or '..' segment or an unencoded special character");
    }

    const url = new URL(`${this.apiBase}${path}`);

    // Belt and braces: whatever the path held, the request must stay inside the API
    const base = new URL(this.apiBase);
    if (url.origin !== base.origin || !url.pathname.startsWith(`${base.pathname}/`)) {
      throw new Error("Invalid request path: it resolves outside the Forgejo API");
    }

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `token ${this.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...extra,
    };
  }

  /** Strip sensitive information from URLs for error messages */
  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove any auth info from the URL; keep path + search for debugging
      return `${parsed.origin}${parsed.pathname}${parsed.search ? "?[params]" : ""}`;
    } catch {
      return "[invalid URL]";
    }
  }

  async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: QueryParams;
    }
  ): Promise<T> {
    const url = this.buildUrl(path, options?.params);

    return this.withTimeout(async (signal) => {
      const response = await fetch(url.toString(), {
        method,
        headers: this.headers(),
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal,
      });

      if (!response.ok) {
        let message: string;
        try {
          const err = JSON.parse(await this.readText(response, "truncate")) as { message?: string };
          message = err.message || response.statusText;
        } catch {
          message = response.statusText;
        }
        throw new ForgejoApiError(message, this.sanitizeUrl(url.toString()), response.status);
      }

      return this.parseBody<T>(response);
    });
  }

  private async parseBody<T>(response: Response): Promise<T> {
    if (response.status === 204) {
      return undefined as T;
    }

    // Some endpoints (e.g. merge_pull_request, update_pr_branch) return a
    // success status with an empty body, and others (render_markdown,
    // render_markup) return raw HTML rather than JSON. Read the body as text
    // first so these don't blow up on JSON.parse.
    const text = await this.readText(response, "error");
    if (text.length === 0) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return JSON.parse(text) as T;
    }

    // Non-JSON body (e.g. rendered HTML). Fall back to JSON in case the server
    // omitted the content-type, otherwise return the raw text.
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  async get<T>(path: string, params?: QueryParams): Promise<T> {
    return this.request<T>("GET", path, { params });
  }

  async post<T>(path: string, body?: unknown, params?: QueryParams): Promise<T> {
    return this.request<T>("POST", path, { body, params });
  }

  async patch<T>(path: string, body?: unknown, params?: QueryParams): Promise<T> {
    return this.request<T>("PATCH", path, { body, params });
  }

  async put<T>(path: string, body?: unknown, params?: QueryParams): Promise<T> {
    return this.request<T>("PUT", path, { body, params });
  }

  async delete<T = void>(path: string, body?: unknown, params?: QueryParams): Promise<T> {
    return this.request<T>("DELETE", path, { body, params });
  }

  async getRaw(path: string, params?: QueryParams): Promise<string> {
    const url = this.buildUrl(path, params);

    return this.withTimeout(async (signal) => {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `token ${this.token}`,
          Accept: "text/plain",
        },
        signal,
      });

      if (!response.ok) {
        throw new ForgejoApiError(response.statusText, this.sanitizeUrl(url.toString()), response.status);
      }

      // Logs, diffs and files are still useful cut short, unlike JSON
      return this.readText(response, "truncate");
    });
  }

  /**
   * Run a request under the configured timeout, which covers reading the body
   * as well as waiting for the response. Without it a stalled connection would
   * leave the tool call (and in HTTP mode the client's stream) open forever.
   */
  private async withTimeout<T>(run: (signal: AbortSignal | undefined) => Promise<T>): Promise<T> {
    const signal = this.timeoutMs > 0 ? AbortSignal.timeout(this.timeoutMs) : undefined;
    try {
      return await run(signal);
    } catch (error) {
      if (signal?.aborted) {
        throw new Error(
          `Request to Forgejo timed out after ${this.timeoutMs / 1000}s. ` +
            "A change the request started may still complete on the server. Raise FORGEJO_TIMEOUT_MS for slow operations."
        );
      }
      throw error;
    }
  }

  /**
   * Read a response body as text, holding at most maxResponseBytes in memory.
   * A larger body is either cut off with a notice or refused, so one call for
   * a huge log or file cannot exhaust the process.
   */
  private async readText(response: Response, onOverflow: "error" | "truncate"): Promise<string> {
    const limit = this.maxResponseBytes;
    const tooLarge = () =>
      new Error(
        `Response from Forgejo is larger than ${describeBytes(limit)}. ` +
          "Narrow the request (for example with pagination) or raise FORGEJO_MAX_RESPONSE_BYTES."
      );
    const notice = `\n\n[Truncated: the response was larger than ${describeBytes(limit)}. Raise FORGEJO_MAX_RESPONSE_BYTES to read more.]`;

    const reader = response.body?.getReader();
    if (!reader) {
      // No stream to meter (an empty body, or a test double), so check after the fact
      const text = await response.text();
      if (text.length <= limit) {
        return text;
      }
      if (onOverflow === "error") {
        throw tooLarge();
      }
      return text.slice(0, limit) + notice;
    }

    // Refuse up front when the server says the body is too big to be useful
    const declared = Number(response.headers?.get("content-length"));
    if (onOverflow === "error" && declared > limit) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge();
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    let overflowed = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (total + value.byteLength > limit) {
        chunks.push(value.subarray(0, limit - total));
        overflowed = true;
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }

    if (overflowed && onOverflow === "error") {
      throw tooLarge();
    }
    const text = Buffer.concat(chunks).toString("utf8");
    return overflowed ? text + notice : text;
  }
}

export class ForgejoApiError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly status: number
  ) {
    super(`Forgejo API error (${status}): ${message}`);
    this.name = "ForgejoApiError";
  }
}
