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

  const hostname = parsed.hostname.toLowerCase();

  // Warn (not block) for HTTP - some dev instances use it
  if (parsed.protocol === "http:" && hostname !== "localhost" && hostname !== "127.0.0.1") {
    console.error(
      "WARNING: FORGEJO_URL uses HTTP. Tokens will be sent unencrypted. Use HTTPS in production."
    );
  }

  // Block cloud metadata endpoints (SSRF)
  if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
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
    token,
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
        // --disable-<area>, e.g. --disable-admin
        if (args[i].startsWith("--disable-")) {
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

  return {
    baseUrl: cleanUrl,
    token,
    ...(disabledAreas.length > 0 ? { disabledAreas } : {}),
  };
}
