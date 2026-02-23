import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ForgejoClient, ForgejoApiError } from "../client.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeClient(baseUrl = "https://forgejo.example.com", token = "test-token") {
  return new ForgejoClient({ baseUrl, token });
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? "Not Found" : "OK",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  });
}

function textResponse(body: string, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    text: () => Promise.resolve(body),
  });
}

function noContentResponse() {
  return Promise.resolve({
    ok: true,
    status: 204,
    statusText: "No Content",
    json: () => Promise.resolve(undefined),
    text: () => Promise.resolve(""),
  });
}

function errorResponse(status: number, message: string) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: message,
    json: () => Promise.resolve({ message }),
    text: () => Promise.resolve(message),
  });
}

describe("ForgejoClient", () => {
  describe("GET requests", () => {
    it("constructs the correct URL with API base path", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 1 }));

      await client.get("/repos/search");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://forgejo.example.com/api/v1/repos/search");
    });

    it("includes the Authorization header with token", async () => {
      const client = makeClient("https://forgejo.example.com", "my-secret-token");
      mockFetch.mockReturnValueOnce(jsonResponse({}));

      await client.get("/user");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Authorization).toBe("token my-secret-token");
    });

    it("includes Content-Type and Accept headers", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(jsonResponse({}));

      await client.get("/user");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers["Content-Type"]).toBe("application/json");
      expect(options.headers.Accept).toBe("application/json");
    });

    it("uses GET method", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(jsonResponse({}));

      await client.get("/user");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("GET");
    });

    it("does not send a body", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(jsonResponse({}));

      await client.get("/user");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.body).toBeUndefined();
    });

    it("returns parsed JSON body", async () => {
      const client = makeClient();
      const expected = { login: "testuser", id: 42 };
      mockFetch.mockReturnValueOnce(jsonResponse(expected));

      const result = await client.get("/user");
      expect(result).toEqual(expected);
    });
  });

  describe("Query parameters", () => {
    it("appends query params to the URL", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(jsonResponse({ data: [] }));

      await client.get("/repos/search", { q: "test", page: 2, limit: 10 });

      const [url] = mockFetch.mock.calls[0];
      const parsed = new URL(url);
      expect(parsed.searchParams.get("q")).toBe("test");
      expect(parsed.searchParams.get("page")).toBe("2");
      expect(parsed.searchParams.get("limit")).toBe("10");
    });

    it("omits undefined params", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(jsonResponse({}));

      await client.get("/repos/search", { q: "hello", page: undefined });

      const [url] = mockFetch.mock.calls[0];
      const parsed = new URL(url);
      expect(parsed.searchParams.get("q")).toBe("hello");
      expect(parsed.searchParams.has("page")).toBe(false);
    });

    it("converts boolean params to strings", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(jsonResponse({}));

      await client.get("/repos/search", { exclusive: true });

      const [url] = mockFetch.mock.calls[0];
      const parsed = new URL(url);
      expect(parsed.searchParams.get("exclusive")).toBe("true");
    });
  });

  describe("POST requests", () => {
    it("sends body as JSON", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 1 }));

      const body = { name: "new-repo", private: true };
      await client.post("/user/repos", body);

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("POST");
      expect(options.body).toBe(JSON.stringify(body));
    });

    it("sends POST with no body when body is undefined", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(jsonResponse({}));

      await client.post("/some/path");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("POST");
      expect(options.body).toBeUndefined();
    });

    it("includes query params when provided", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(jsonResponse({}));

      await client.post("/some/path", { key: "val" }, { page: 1 });

      const [url, options] = mockFetch.mock.calls[0];
      expect(options.body).toBe(JSON.stringify({ key: "val" }));
      const parsed = new URL(url);
      expect(parsed.searchParams.get("page")).toBe("1");
    });
  });

  describe("PATCH requests", () => {
    it("sends body as JSON with PATCH method", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(jsonResponse({ updated: true }));

      const body = { title: "Updated Title" };
      await client.patch("/repos/owner/repo/issues/1", body);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://forgejo.example.com/api/v1/repos/owner/repo/issues/1");
      expect(options.method).toBe("PATCH");
      expect(options.body).toBe(JSON.stringify(body));
    });
  });

  describe("PUT requests", () => {
    it("sends PUT request with body", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(jsonResponse({}));

      const body = { permission: "write" };
      await client.put("/teams/1/members/user1", body);

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("PUT");
      expect(options.body).toBe(JSON.stringify(body));
    });

    it("sends PUT request without body", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(noContentResponse());

      await client.put("/user/starred/owner/repo");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("PUT");
      expect(options.body).toBeUndefined();
    });
  });

  describe("DELETE requests", () => {
    it("sends DELETE request", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(noContentResponse());

      await client.delete("/repos/owner/repo");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://forgejo.example.com/api/v1/repos/owner/repo");
      expect(options.method).toBe("DELETE");
      expect(options.body).toBeUndefined();
    });
  });

  describe("204 No Content responses", () => {
    it("returns undefined for 204 responses", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(noContentResponse());

      const result = await client.delete("/repos/owner/repo");
      expect(result).toBeUndefined();
    });
  });

  describe("API error handling", () => {
    it("throws ForgejoApiError on non-OK responses", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(errorResponse(404, "Not Found"));

      await expect(client.get("/repos/owner/nonexistent")).rejects.toThrow(ForgejoApiError);
    });

    it("includes the status code in the error", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(errorResponse(403, "Forbidden"));

      try {
        await client.get("/admin/users");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ForgejoApiError);
        expect((err as ForgejoApiError).status).toBe(403);
      }
    });

    it("includes the error message from the API", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(errorResponse(422, "Validation failed"));

      try {
        await client.post("/user/repos", { name: "" });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ForgejoApiError);
        expect((err as ForgejoApiError).message).toContain("Validation failed");
      }
    });

    it("includes the URL in the error", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(errorResponse(500, "Internal Server Error"));

      try {
        await client.get("/version");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ForgejoApiError);
        expect((err as ForgejoApiError).url).toContain("/api/v1/version");
      }
    });

    it("falls back to statusText if JSON parsing fails", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 502,
          statusText: "Bad Gateway",
          json: () => Promise.reject(new Error("not json")),
        })
      );

      try {
        await client.get("/version");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ForgejoApiError);
        expect((err as ForgejoApiError).message).toContain("Bad Gateway");
      }
    });
  });

  describe("request method", () => {
    it("supports DELETE with a body via request()", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(noContentResponse());

      await client.request("DELETE", "/repos/owner/repo/contents/file.txt", {
        body: { sha: "abc123", message: "delete file" },
      });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe("DELETE");
      expect(options.body).toBe(JSON.stringify({ sha: "abc123", message: "delete file" }));
    });
  });

  describe("getRaw", () => {
    it("returns text content", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(textResponse("diff --git a/file.txt b/file.txt\n+hello"));

      const result = await client.getRaw("/repos/owner/repo/pulls/1.diff");
      expect(result).toBe("diff --git a/file.txt b/file.txt\n+hello");
    });

    it("uses Accept: text/plain header", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(textResponse("content"));

      await client.getRaw("/repos/owner/repo/raw/README.md");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Accept).toBe("text/plain");
    });

    it("includes Authorization header", async () => {
      const client = makeClient("https://example.com", "raw-token");
      mockFetch.mockReturnValueOnce(textResponse("data"));

      await client.getRaw("/some/path");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Authorization).toBe("token raw-token");
    });

    it("appends query params to the URL", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(textResponse("data"));

      await client.getRaw("/some/path", { ref: "main" });

      const [url] = mockFetch.mock.calls[0];
      const parsed = new URL(url);
      expect(parsed.searchParams.get("ref")).toBe("main");
    });

    it("throws ForgejoApiError on non-OK responses", async () => {
      const client = makeClient();
      mockFetch.mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
        })
      );

      await expect(client.getRaw("/nonexistent")).rejects.toThrow(ForgejoApiError);
    });
  });
});
