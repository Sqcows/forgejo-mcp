/** Tool areas that can be switched off individually. All are enabled by default. */
export const TOOL_AREAS = [
  "repository",
  "repo-settings",
  "issues",
  "pull-requests",
  "organizations",
  "users",
  "actions",
  "packages",
  "admin",
] as const;

export type ToolArea = (typeof TOOL_AREAS)[number];

export interface ForgejoConfig {
  baseUrl: string;
  token: string;
  /** Tool areas to leave unregistered. Omitted or empty means every area is loaded. */
  disabledAreas?: ToolArea[];
  /** Give up on a Forgejo request after this long. 0 disables the timeout. Default: DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Largest response body to read from Forgejo. Default: DEFAULT_MAX_RESPONSE_BYTES. */
  maxResponseBytes?: number;
}

/** Long enough for slow operations such as repository migration, short enough that a stalled connection does not hang a tool call forever */
export const DEFAULT_TIMEOUT_MS = 120_000;

/** Bounds memory use when a tool fetches a large log, diff, or file */
export const DEFAULT_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

/**
 * Read a non-negative integer setting from the environment. An unset, empty,
 * or malformed value yields the fallback rather than NaN, which would silently
 * disable (or permanently trip) whatever the number controls.
 */
export function envInt(name: string, fallback: number, min = 0): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    console.error(`WARNING: ignoring invalid ${name}="${raw}"; using ${fallback}.`);
    return fallback;
  }
  return value;
}

/**
 * Trim the token and reject one that cannot be sent as a header value. Left
 * unchecked, fetch would refuse it with an error that quotes the whole header,
 * putting the token into tool output.
 */
function cleanToken(token: string): string {
  const trimmed = token.trim();
  // eslint-disable-next-line no-control-regex
  if (trimmed.length === 0 || /[\s\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new Error("Forgejo token is empty or contains whitespace or control characters. Check FORGEJO_TOKEN / --token.");
  }
  return trimmed;
}

/**
 * Parse a comma-separated list of tool areas (e.g. "admin,actions").
 * Throws on unknown names so a typo doesn't silently leave an area enabled.
 */
export function parseToolAreas(value: string | undefined): ToolArea[] {
  if (!value) return [];
  const areas: ToolArea[] = [];
  for (const raw of value.split(",")) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    if (!(TOOL_AREAS as readonly string[]).includes(name)) {
      throw new Error(`Unknown tool area "${name}". Valid areas: ${TOOL_AREAS.join(", ")}`);
    }
    if (!areas.includes(name as ToolArea)) areas.push(name as ToolArea);
  }
  return areas;
}

const METADATA_HOSTNAMES = new Set(["metadata.google.internal", "metadata.goog", "instance-data"]);

/**
 * Whether a (lower-cased) URL hostname is a cloud metadata service. Covers the
 * link-local range those services live in (169.254.0.0/16, fe80::/10), the
 * AWS IPv6 endpoint, and IPv4 addresses written as IPv4-mapped IPv6, which
 * URL parsing normalizes to e.g. "[::ffff:a9fe:a9fe]".
 */
function isMetadataHost(hostname: string): boolean {
  if (METADATA_HOSTNAMES.has(hostname) || hostname.startsWith("169.254.")) {
    return true;
  }
  if (!hostname.startsWith("[")) {
    return false;
  }
  const ipv6 = hostname.slice(1, -1);
  if (ipv6 === "fd00:ec2::254" || /^fe[89ab][0-9a-f]:/.test(ipv6)) {
    return true;
  }
  const mapped = ipv6.match(/^::ffff:([0-9a-f]{1,4}):[0-9a-f]{1,4}$/);
  return mapped !== null && parseInt(mapped[1], 16) >> 8 === 169 && (parseInt(mapped[1], 16) & 0xff) === 254;
}

/**
 * Validate the base URL for safety.
 * Blocks private IPs, metadata endpoints, and non-HTTP protocols.
 */
function validateBaseUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid FORGEJO_URL: "${url}" is not a valid URL`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("FORGEJO_URL must use http or https protocol");
  }

  // Credentials in the URL would be echoed back in fetch errors, and a query or
  // fragment would swallow every API path appended to it
  if (parsed.username || parsed.password) {
    throw new Error("FORGEJO_URL must not contain credentials. Use FORGEJO_TOKEN for authentication.");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("FORGEJO_URL must not contain a query string or fragment");
  }

  // "example.com." and "example.com" are the same host
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");

  // Warn (not block) for HTTP - some dev instances use it
  if (parsed.protocol === "http:" && hostname !== "localhost" && hostname !== "127.0.0.1") {
    console.error(
      "WARNING: FORGEJO_URL uses HTTP. Tokens will be sent unencrypted. Use HTTPS in production."
    );
  }

  // Block cloud metadata endpoints (SSRF)
  if (isMetadataHost(hostname)) {
    throw new Error("FORGEJO_URL must not point to cloud metadata services");
  }

  // Block common internal ranges when hostname is an IP
  const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number);
    if (
      a === 10 ||
      (a === 172 && b !== undefined && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0
    ) {
      console.error(
        "WARNING: FORGEJO_URL points to a private IP address. Ensure this is intentional."
      );
    }
  }
}

export function loadConfig(): ForgejoConfig {
  const baseUrl = process.env.FORGEJO_URL;
  const token = process.env.FORGEJO_TOKEN;

  if (!baseUrl) {
    throw new Error(
      "FORGEJO_URL environment variable is required. Set it to your Forgejo/Gitea instance URL (e.g., https://codeberg.org)"
    );
  }

  if (!token) {
    throw new Error(
      "FORGEJO_TOKEN environment variable is required. Generate one at {your-instance}/user/settings/applications"
    );
  }

  const cleanUrl = baseUrl.replace(/\/+$/, "");
  validateBaseUrl(cleanUrl);

  return {
    baseUrl: cleanUrl,
    token: cleanToken(token),
  };
}

export function parseCliArgs(args: string[]): Partial<ForgejoConfig> & { port?: number } {
  const result: Partial<ForgejoConfig> & { port?: number } = {};
  const disabled: ToolArea[] = [];

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--url":
        result.baseUrl = args[++i]?.replace(/\/+$/, "");
        break;
      case "--token":
        result.token = args[++i];
        break;
      case "--port":
        result.port = parseInt(args[++i], 10);
        break;
      case "--disable":
        disabled.push(...parseToolAreas(args[++i]));
        break;
      default:
        // --disable-<area> or --disable=<areas>, e.g. --disable-admin, --disable=admin,actions.
        // The "=" form is accepted so it is not silently ignored, leaving the areas enabled.
        if (args[i].startsWith("--disable-") || args[i].startsWith("--disable=")) {
          disabled.push(...parseToolAreas(args[i].slice("--disable-".length)));
        }
    }
  }

  if (disabled.length > 0) {
    result.disabledAreas = [...new Set(disabled)];
  }

  return result;
}

export function resolveConfig(cliArgs?: Partial<ForgejoConfig>): ForgejoConfig {
  const baseUrl = cliArgs?.baseUrl || process.env.FORGEJO_URL;
  const token = cliArgs?.token || process.env.FORGEJO_TOKEN;

  if (!baseUrl) {
    throw new Error(
      "Forgejo URL is required. Set FORGEJO_URL env var or pass --url <url>"
    );
  }

  if (!token) {
    throw new Error(
      "Forgejo token is required. Set FORGEJO_TOKEN env var or pass --token <token>"
    );
  }

  const cleanUrl = baseUrl.replace(/\/+$/, "");
  validateBaseUrl(cleanUrl);

  // Areas disabled on the command line and in the environment are combined
  const disabledAreas = [
    ...new Set([...(cliArgs?.disabledAreas ?? []), ...parseToolAreas(process.env.FORGEJO_DISABLED_AREAS)]),
  ];

  // Only set when configured, so the client's defaults apply otherwise
  const timeoutMs = process.env.FORGEJO_TIMEOUT_MS ? envInt("FORGEJO_TIMEOUT_MS", DEFAULT_TIMEOUT_MS) : undefined;
  const maxResponseBytes = process.env.FORGEJO_MAX_RESPONSE_BYTES
    ? envInt("FORGEJO_MAX_RESPONSE_BYTES", DEFAULT_MAX_RESPONSE_BYTES, 1024)
    : undefined;

  return {
    baseUrl: cleanUrl,
    token: cleanToken(token),
    ...(disabledAreas.length > 0 ? { disabledAreas } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    ...(maxResponseBytes !== undefined ? { maxResponseBytes } : {}),
  };
}
