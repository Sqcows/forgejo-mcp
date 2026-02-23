import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfig, parseCliArgs, resolveConfig } from "../config.js";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reads baseUrl and token from environment variables", () => {
    process.env.FORGEJO_URL = "https://codeberg.org";
    process.env.FORGEJO_TOKEN = "abc123";

    const config = loadConfig();
    expect(config.baseUrl).toBe("https://codeberg.org");
    expect(config.token).toBe("abc123");
  });

  it("throws if FORGEJO_URL is missing", () => {
    delete process.env.FORGEJO_URL;
    process.env.FORGEJO_TOKEN = "abc123";

    expect(() => loadConfig()).toThrow("FORGEJO_URL");
  });

  it("throws if FORGEJO_TOKEN is missing", () => {
    process.env.FORGEJO_URL = "https://codeberg.org";
    delete process.env.FORGEJO_TOKEN;

    expect(() => loadConfig()).toThrow("FORGEJO_TOKEN");
  });

  it("throws if both FORGEJO_URL and FORGEJO_TOKEN are missing", () => {
    delete process.env.FORGEJO_URL;
    delete process.env.FORGEJO_TOKEN;

    expect(() => loadConfig()).toThrow("FORGEJO_URL");
  });

  it("strips trailing slashes from the URL", () => {
    process.env.FORGEJO_URL = "https://codeberg.org///";
    process.env.FORGEJO_TOKEN = "abc123";

    const config = loadConfig();
    expect(config.baseUrl).toBe("https://codeberg.org");
  });

  it("strips single trailing slash from the URL", () => {
    process.env.FORGEJO_URL = "https://codeberg.org/";
    process.env.FORGEJO_TOKEN = "abc123";

    const config = loadConfig();
    expect(config.baseUrl).toBe("https://codeberg.org");
  });

  it("preserves URL without trailing slashes", () => {
    process.env.FORGEJO_URL = "https://codeberg.org";
    process.env.FORGEJO_TOKEN = "abc123";

    const config = loadConfig();
    expect(config.baseUrl).toBe("https://codeberg.org");
  });
});

describe("parseCliArgs", () => {
  it("parses --url argument", () => {
    const result = parseCliArgs(["--url", "https://forgejo.example.com"]);
    expect(result.baseUrl).toBe("https://forgejo.example.com");
  });

  it("parses --token argument", () => {
    const result = parseCliArgs(["--token", "my-token"]);
    expect(result.token).toBe("my-token");
  });

  it("parses --port argument", () => {
    const result = parseCliArgs(["--port", "8080"]);
    expect(result.port).toBe(8080);
  });

  it("parses all arguments together", () => {
    const result = parseCliArgs([
      "--url", "https://forgejo.example.com",
      "--token", "my-token",
      "--port", "3000",
    ]);
    expect(result.baseUrl).toBe("https://forgejo.example.com");
    expect(result.token).toBe("my-token");
    expect(result.port).toBe(3000);
  });

  it("returns empty object for no arguments", () => {
    const result = parseCliArgs([]);
    expect(result.baseUrl).toBeUndefined();
    expect(result.token).toBeUndefined();
    expect(result.port).toBeUndefined();
  });

  it("strips trailing slashes from --url", () => {
    const result = parseCliArgs(["--url", "https://forgejo.example.com///"]);
    expect(result.baseUrl).toBe("https://forgejo.example.com");
  });

  it("ignores unknown arguments", () => {
    const result = parseCliArgs(["--unknown", "value", "--url", "https://example.com"]);
    expect(result.baseUrl).toBe("https://example.com");
  });
});

describe("resolveConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses CLI args over environment variables", () => {
    process.env.FORGEJO_URL = "https://env-url.com";
    process.env.FORGEJO_TOKEN = "env-token";

    const config = resolveConfig({
      baseUrl: "https://cli-url.com",
      token: "cli-token",
    });

    expect(config.baseUrl).toBe("https://cli-url.com");
    expect(config.token).toBe("cli-token");
  });

  it("falls back to env vars when CLI args are not provided", () => {
    process.env.FORGEJO_URL = "https://env-url.com";
    process.env.FORGEJO_TOKEN = "env-token";

    const config = resolveConfig({});
    expect(config.baseUrl).toBe("https://env-url.com");
    expect(config.token).toBe("env-token");
  });

  it("falls back to env vars when no CLI args object is provided", () => {
    process.env.FORGEJO_URL = "https://env-url.com";
    process.env.FORGEJO_TOKEN = "env-token";

    const config = resolveConfig();
    expect(config.baseUrl).toBe("https://env-url.com");
    expect(config.token).toBe("env-token");
  });

  it("throws if no URL is available from any source", () => {
    delete process.env.FORGEJO_URL;
    process.env.FORGEJO_TOKEN = "token";

    expect(() => resolveConfig({})).toThrow("Forgejo URL is required");
  });

  it("throws if no token is available from any source", () => {
    process.env.FORGEJO_URL = "https://example.com";
    delete process.env.FORGEJO_TOKEN;

    expect(() => resolveConfig({})).toThrow("Forgejo token is required");
  });

  it("strips trailing slashes from the resolved URL", () => {
    process.env.FORGEJO_URL = "https://example.com///";
    process.env.FORGEJO_TOKEN = "token";

    const config = resolveConfig();
    expect(config.baseUrl).toBe("https://example.com");
  });

  it("mixes CLI baseUrl with env token", () => {
    delete process.env.FORGEJO_URL;
    process.env.FORGEJO_TOKEN = "env-token";

    const config = resolveConfig({ baseUrl: "https://cli-url.com" });
    expect(config.baseUrl).toBe("https://cli-url.com");
    expect(config.token).toBe("env-token");
  });

  it("mixes env baseUrl with CLI token", () => {
    process.env.FORGEJO_URL = "https://env-url.com";
    delete process.env.FORGEJO_TOKEN;

    const config = resolveConfig({ token: "cli-token" });
    expect(config.baseUrl).toBe("https://env-url.com");
    expect(config.token).toBe("cli-token");
  });
});
