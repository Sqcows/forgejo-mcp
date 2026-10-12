import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_TIMEOUT_MS, envInt, loadConfig, parseCliArgs, parseToolAreas, resolveConfig } from "../config.js";

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

describe("tool area flags", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, FORGEJO_URL: "https://env-url.com", FORGEJO_TOKEN: "env-token" };
    delete process.env.FORGEJO_DISABLED_AREAS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("enables every area by default", () => {
    expect(parseCliArgs([]).disabledAreas).toBeUndefined();
    expect(resolveConfig().disabledAreas).toBeUndefined();
  });

  it("parses --disable-<area> flags", () => {
    const args = parseCliArgs(["--disable-admin", "--url", "https://x.com", "--disable-repo-settings"]);
    expect(args.disabledAreas).toEqual(["admin", "repo-settings"]);
    expect(args.baseUrl).toBe("https://x.com");
  });

  it("parses a comma-separated --disable list", () => {
    expect(parseCliArgs(["--disable", "actions, Packages,actions"]).disabledAreas).toEqual(["actions", "packages"]);
  });

  it("parses the --disable=<areas> form instead of ignoring it", () => {
    expect(parseCliArgs(["--disable=admin,actions"]).disabledAreas).toEqual(["admin", "actions"]);
    expect(() => parseCliArgs(["--disable=nope"])).toThrow('Unknown tool area "nope"');
  });

  it("rejects unknown areas", () => {
    expect(() => parseCliArgs(["--disable-nope"])).toThrow('Unknown tool area "nope"');
    expect(() => parseToolAreas("admin,bogus")).toThrow("Valid areas:");
  });

  it("reads FORGEJO_DISABLED_AREAS and combines it with CLI flags", () => {
    process.env.FORGEJO_DISABLED_AREAS = "admin,users";
    expect(resolveConfig().disabledAreas).toEqual(["admin", "users"]);
    expect(resolveConfig({ disabledAreas: ["actions", "admin"] }).disabledAreas).toEqual(["actions", "admin", "users"]);
  });
});

describe("configuration hardening", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, FORGEJO_URL: "https://env-url.com", FORGEJO_TOKEN: "env-token" };
    delete process.env.FORGEJO_TIMEOUT_MS;
    delete process.env.FORGEJO_MAX_RESPONSE_BYTES;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("trims the token and rejects one that cannot be sent as a header", () => {
    expect(resolveConfig({ token: "  abc123\n" }).token).toBe("abc123");
    expect(() => resolveConfig({ token: "abc\n123" })).toThrow("whitespace or control characters");
    expect(() => resolveConfig({ token: "   " })).toThrow("Forgejo token");
    // The message must not quote the token back
    expect(() => resolveConfig({ token: "sec ret" })).not.toThrow(/sec ret/);
  });

  it("rejects base URLs carrying credentials, a query, or a fragment", () => {
    expect(() => resolveConfig({ baseUrl: "https://user:pass@forgejo.example.com" })).toThrow("must not contain credentials");
    expect(() => resolveConfig({ baseUrl: "https://forgejo.example.com/?x=1" })).toThrow("query string or fragment");
  });

  it.each([
    "http://169.254.169.254",
    "http://169.254.170.2",
    "http://[::ffff:169.254.169.254]",
    "http://[fd00:ec2::254]",
    "http://[fe80::1]",
    "http://metadata.google.internal.",
    "http://2852039166",
  ])("blocks the metadata address %s", (url) => {
    expect(() => resolveConfig({ baseUrl: url })).toThrow("cloud metadata");
  });

  it("still allows ordinary hosts, including IPv6 loopback", () => {
    expect(resolveConfig({ baseUrl: "http://[::1]:3000" }).baseUrl).toBe("http://[::1]:3000");
    expect(resolveConfig({ baseUrl: "https://codeberg.org/" }).baseUrl).toBe("https://codeberg.org");
  });

  it("reads the timeout and response limit from the environment, leaving defaults otherwise", () => {
    expect(resolveConfig().timeoutMs).toBeUndefined();
    expect(resolveConfig().maxResponseBytes).toBeUndefined();

    process.env.FORGEJO_TIMEOUT_MS = "0";
    process.env.FORGEJO_MAX_RESPONSE_BYTES = "2097152";
    expect(resolveConfig().timeoutMs).toBe(0);
    expect(resolveConfig().maxResponseBytes).toBe(2097152);
  });

  it("falls back to the default for a malformed number instead of NaN", () => {
    process.env.RATE_LIMIT_MAX = "lots";
    expect(envInt("RATE_LIMIT_MAX", 100, 1)).toBe(100);
    process.env.RATE_LIMIT_MAX = "0";
    expect(envInt("RATE_LIMIT_MAX", 100, 1)).toBe(100);
    process.env.RATE_LIMIT_MAX = "250";
    expect(envInt("RATE_LIMIT_MAX", 100, 1)).toBe(250);
    delete process.env.RATE_LIMIT_MAX;
    expect(envInt("RATE_LIMIT_MAX", 100, 1)).toBe(100);

    process.env.FORGEJO_TIMEOUT_MS = "soon";
    expect(resolveConfig().timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
  });
});
