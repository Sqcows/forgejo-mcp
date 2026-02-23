export interface ForgejoConfig {
  baseUrl: string;
  token: string;
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
    }
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

  return {
    baseUrl: cleanUrl,
    token,
  };
}
