import type { ForgejoConfig } from "./config.js";

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ApiError {
  message: string;
  url: string;
  status: number;
}

export class ForgejoClient {
  private baseUrl: string;
  private token: string;

  constructor(config: ForgejoConfig) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
  }

  private get apiBase(): string {
    return `${this.baseUrl}/api/v1`;
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
      params?: Record<string, string | number | boolean | undefined>;
    }
  ): Promise<T> {
    const url = new URL(`${this.apiBase}${path}`);

    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: this.headers(),
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      let message: string;
      try {
        const err = (await response.json()) as { message?: string };
        message = err.message || response.statusText;
      } catch {
        message = response.statusText;
      }
      throw new ForgejoApiError(message, this.sanitizeUrl(url.toString()), response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  async get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>("GET", path, { params });
  }

  async post<T>(path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>("POST", path, { body, params });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, { body });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, { body });
  }

  async delete<T = void>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  async getRaw(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<string> {
    const url = new URL(`${this.apiBase}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `token ${this.token}`,
        Accept: "text/plain",
      },
    });

    if (!response.ok) {
      throw new ForgejoApiError(response.statusText, this.sanitizeUrl(url.toString()), response.status);
    }

    return response.text();
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
