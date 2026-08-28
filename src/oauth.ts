import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const CLIENT_ID = "forgejo-mcp";
export const OAUTH_SCOPE = "mcp";
export const CODE_TTL_MS = 10 * 60 * 1000;
export const ACCESS_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const BODY_LIMIT = 64 * 1024;
const TOKEN_PREFIX = {
  c: "fj1c",
  a: "fj1a",
  r: "fj1r",
} as const;

type TokenKind = keyof typeof TOKEN_PREFIX;

interface TokenPayload {
  v: 1;
  typ: TokenKind;
  iat: number;
  exp: number;
  jti: string;
  redirect_uri?: string;
  code_challenge?: string;
}

export interface OAuthContext {
  secret: string;
  issuer: string;
}

export interface OAuthRequest {
  method: string;
  url: URL;
  header(name: string): string | undefined;
  body: string;
}

export interface OAuthResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

const OAUTH_PATHS = new Map<string, Set<string>>([
  ["/.well-known/oauth-authorization-server", new Set(["GET", "OPTIONS"])],
  ["/.well-known/oauth-protected-resource", new Set(["GET", "OPTIONS"])],
  ["/.well-known/oauth-protected-resource/mcp", new Set(["GET", "OPTIONS"])],
  ["/oauth/register", new Set(["POST", "OPTIONS"])],
  ["/oauth/authorize", new Set(["GET", "OPTIONS"])],
  ["/oauth/confirm", new Set(["POST", "OPTIONS"])],
  ["/oauth/token", new Set(["POST", "OPTIONS"])],
]);

/** Best-effort single-use tracking for auth codes and refresh tokens. Lost on restart. */
const consumed = new Map<string, number>();

export function resetOAuthReplayCache(): void {
  consumed.clear();
}

function pruneConsumed(now = Date.now()): void {
  for (const [key, exp] of consumed) {
    if (now >= exp) consumed.delete(key);
  }
}

function consume(token: string, ttlMs: number): boolean {
  pruneConsumed();
  if (consumed.has(token)) return false;
  consumed.set(token, Date.now() + ttlMs);
  return true;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function hmac(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function sha256b64url(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw.split(",")[0]?.trim() || undefined;
}

export function resolveIssuer(
  headers: NodeJS.Dict<string | string[] | undefined>,
  publicUrl?: string
): string {
  const override = publicUrl?.replace(/\/+$/, "");
  if (override) return override;

  const host =
    firstHeaderValue(headers["x-forwarded-host"]) ||
    firstHeaderValue(headers.host) ||
    "localhost";
  const proto = firstHeaderValue(headers["x-forwarded-proto"]) || "http";
  return `${proto}://${host}`;
}

export function authorizationServerMetadata(issuer: string): Record<string, unknown> {
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [OAUTH_SCOPE],
  };
}

export function protectedResourceMetadata(issuer: string): Record<string, unknown> {
  return {
    resource: `${issuer}/mcp`,
    authorization_servers: [issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: [OAUTH_SCOPE],
  };
}

export function unauthorizedHeaders(issuer: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "WWW-Authenticate": `Bearer realm="Forgejo MCP", resource_metadata="${issuer}/.well-known/oauth-protected-resource"`,
    "Access-Control-Allow-Origin": "*",
  };
}

export function writeUnauthorized(res: ServerResponse, issuer: string): void {
  res.writeHead(401, unauthorizedHeaders(issuer));
  res.end(JSON.stringify({ error: "Unauthorized" }));
}

export function signToken(secret: string, kind: TokenKind, payload: Omit<TokenPayload, "v" | "typ">): string {
  const body: TokenPayload = { v: 1, typ: kind, ...payload };
  const encoded = b64urlJson(body);
  const prefix = TOKEN_PREFIX[kind];
  return `${prefix}.${encoded}.${hmac(secret, `${prefix}.${encoded}`)}`;
}

export function verifyToken(secret: string, kind: TokenKind, token: string, now = Date.now()): TokenPayload | null {
  const prefix = TOKEN_PREFIX[kind];
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== prefix) return null;
  const [head, encoded, sig] = parts;
  const expected = hmac(secret, `${head}.${encoded}`);
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TokenPayload;
    if (payload.v !== 1 || payload.typ !== kind) return null;
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function isValidBearer(secret: string, token: string): boolean {
  if (!token) return false;
  if (safeEqual(token, secret)) return true;
  return verifyToken(secret, "a", token) !== null;
}

function jsonResponse(status: number, body: unknown, extra: Record<string, string> = {}): OAuthResponse {
  return {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extra,
    },
    body: JSON.stringify(body),
  };
}

function htmlResponse(status: number, body: string): OAuthResponse {
  return {
    status,
    headers: {
      ...CORS,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body,
  };
}

function redirectResponse(location: string): OAuthResponse {
  return {
    status: 302,
    headers: { ...CORS, Location: location, "Cache-Control": "no-store" },
    body: "",
  };
}

function parseRedirectUri(value: string | null): URL | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed;
  } catch {
    return null;
  }
}

function oauthErrorRedirect(redirectUri: URL, error: string, description: string, state: string | null): OAuthResponse {
  redirectUri.searchParams.set("error", error);
  redirectUri.searchParams.set("error_description", description);
  if (state) redirectUri.searchParams.set("state", state);
  return redirectResponse(redirectUri.toString());
}

function parseBody(req: OAuthRequest): Record<string, string> {
  const ct = req.header("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const parsed = JSON.parse(req.body) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") out[key] = value;
      }
      return out;
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(req.body));
}

function registerClient(body: string): OAuthResponse {
  let parsed: Record<string, unknown> = {};
  try {
    const json = JSON.parse(body) as unknown;
    if (json && typeof json === "object" && !Array.isArray(json)) {
      parsed = json as Record<string, unknown>;
    }
  } catch {
    parsed = {};
  }

  const redirectUris = Array.isArray(parsed.redirect_uris)
    ? parsed.redirect_uris.filter((uri): uri is string => typeof uri === "string")
    : [];

  return jsonResponse(
    201,
    {
      client_id: CLIENT_ID,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: OAUTH_SCOPE,
      ...(typeof parsed.client_name === "string" ? { client_name: parsed.client_name } : {}),
    }
  );
}

function consentPage(params: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  clientId: string;
  error?: string;
}): string {
  const client = escapeHtml(params.clientId || "Grok");
  const error = params.error
    ? `<p class="error">${escapeHtml(params.error)}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Authorize Forgejo MCP</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    background:#111;color:#eee;display:flex;align-items:center;
    justify-content:center;min-height:100vh;padding:24px}
  .card{background:#1b1b1f;border:1px solid #2c2c34;border-radius:12px;
    padding:32px;max-width:440px;width:100%}
  h1{font-size:20px;margin-bottom:8px}
  p{color:#aaa;font-size:14px;line-height:1.5;margin-bottom:16px}
  .client{color:#fff;font-weight:600}
  label{display:block;font-size:13px;margin-bottom:6px;color:#ccc}
  input[type=password]{width:100%;padding:10px 12px;border-radius:8px;
    border:1px solid #3a3a44;background:#111;color:#fff;margin-bottom:16px}
  button{width:100%;padding:12px;border:none;border-radius:8px;
    background:#6ea8fe;color:#111;font-weight:600;cursor:pointer}
  .error{color:#f88;margin-bottom:12px}
</style></head>
<body><div class="card">
  <h1>Authorize Forgejo MCP</h1>
  <p><span class="client">${client}</span> is requesting access to this Forgejo MCP server.
     Approving grants the same Forgejo permissions as this server's API token.</p>
  ${error}
  <form method="POST" action="/oauth/confirm">
    <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}">
    <input type="hidden" name="state" value="${escapeHtml(params.state)}">
    <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}">
    <label for="password">HTTP API key</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">Authorize</button>
  </form>
</div></body></html>`;
}

function handleAuthorize(url: URL): OAuthResponse {
  const redirectUri = parseRedirectUri(url.searchParams.get("redirect_uri"));
  const state = url.searchParams.get("state");
  const responseType = url.searchParams.get("response_type") ?? "code";
  const method = url.searchParams.get("code_challenge_method") ?? "S256";
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const clientId = url.searchParams.get("client_id") ?? CLIENT_ID;

  if (!redirectUri) {
    return htmlResponse(400, consentPage({
      redirectUri: "",
      state: "",
      codeChallenge: "",
      clientId,
      error: "Missing or invalid redirect_uri.",
    }));
  }

  if (responseType !== "code") {
    return oauthErrorRedirect(redirectUri, "unsupported_response_type", "Only response_type=code is supported", state);
  }
  if (method !== "S256") {
    return oauthErrorRedirect(redirectUri, "invalid_request", "code_challenge_method must be S256", state);
  }
  if (!codeChallenge) {
    return oauthErrorRedirect(redirectUri, "invalid_request", "PKCE code_challenge is required", state);
  }

  return htmlResponse(200, consentPage({
    redirectUri: redirectUri.toString(),
    state: state ?? "",
    codeChallenge,
    clientId,
  }));
}

function handleConfirm(req: OAuthRequest, ctx: OAuthContext): OAuthResponse {
  const params = new URLSearchParams(req.body);
  const password = params.get("password") ?? "";
  const state = params.get("state") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const redirectUri = parseRedirectUri(params.get("redirect_uri"));

  if (!redirectUri) {
    return htmlResponse(400, consentPage({
      redirectUri: "",
      state: "",
      codeChallenge: "",
      clientId: CLIENT_ID,
      error: "Missing or invalid redirect_uri.",
    }));
  }

  if (!codeChallenge) {
    return htmlResponse(400, consentPage({
      redirectUri: redirectUri.toString(),
      state,
      codeChallenge: "",
      clientId: CLIENT_ID,
      error: "Missing PKCE challenge.",
    }));
  }

  if (!safeEqual(password, ctx.secret)) {
    return htmlResponse(401, consentPage({
      redirectUri: redirectUri.toString(),
      state,
      codeChallenge,
      clientId: CLIENT_ID,
      error: "Invalid API key.",
    }));
  }

  const now = Date.now();
  const code = signToken(ctx.secret, "c", {
    iat: now,
    exp: now + CODE_TTL_MS,
    jti: randomBytes(16).toString("base64url"),
    redirect_uri: redirectUri.toString(),
    code_challenge: codeChallenge,
  });
  redirectUri.searchParams.set("code", code);
  if (state) redirectUri.searchParams.set("state", state);
  return redirectResponse(redirectUri.toString());
}

function tokenError(description: string, status = 400): OAuthResponse {
  return jsonResponse(status, { error: "invalid_grant", error_description: description });
}

function issueTokenPair(secret: string, now = Date.now()): Record<string, unknown> {
  const access = signToken(secret, "a", {
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_MS,
    jti: randomBytes(16).toString("base64url"),
  });
  const refresh = signToken(secret, "r", {
    iat: now,
    exp: now + REFRESH_TOKEN_TTL_MS,
    jti: randomBytes(16).toString("base64url"),
  });
  return {
    access_token: access,
    refresh_token: refresh,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    scope: OAUTH_SCOPE,
  };
}

function handleToken(req: OAuthRequest, ctx: OAuthContext): OAuthResponse {
  const params = parseBody(req);
  const grantType = params.grant_type;

  if (grantType === "refresh_token") {
    const refreshToken = params.refresh_token ?? "";
    const payload = verifyToken(ctx.secret, "r", refreshToken);
    if (!payload) return tokenError("Invalid or expired refresh token");
    if (!consume(refreshToken, REFRESH_TOKEN_TTL_MS)) {
      return tokenError("Refresh token has already been used");
    }
    return jsonResponse(200, issueTokenPair(ctx.secret));
  }

  if (grantType !== "authorization_code") {
    return jsonResponse(400, {
      error: "unsupported_grant_type",
      error_description: "Only authorization_code and refresh_token are supported",
    });
  }

  const code = params.code ?? "";
  const redirectUri = params.redirect_uri ?? "";
  const codeVerifier = params.code_verifier ?? "";
  const payload = verifyToken(ctx.secret, "c", code);
  if (!payload) return tokenError("Invalid or expired authorization code");
  if (!payload.redirect_uri || payload.redirect_uri !== redirectUri) {
    return tokenError("redirect_uri mismatch");
  }
  if (!codeVerifier) {
    return jsonResponse(400, { error: "invalid_request", error_description: "code_verifier required" });
  }
  if (!payload.code_challenge || sha256b64url(codeVerifier) !== payload.code_challenge) {
    return tokenError("PKCE verification failed");
  }
  if (!consume(code, CODE_TTL_MS)) return tokenError("Authorization code has already been used");

  return jsonResponse(200, issueTokenPair(ctx.secret));
}

export function dispatchOAuth(req: OAuthRequest, ctx: OAuthContext): OAuthResponse | null {
  const method = req.method.toUpperCase();
  const path = normalizePath(req.url.pathname);
  const allowed = OAUTH_PATHS.get(path);
  if (!allowed) return null;

  if (method === "OPTIONS") {
    return { status: 204, headers: { ...CORS }, body: "" };
  }
  if (!allowed.has(method)) {
    return {
      status: 405,
      headers: { ...CORS, Allow: [...allowed].join(", "), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  switch (path) {
    case "/.well-known/oauth-authorization-server":
      return jsonResponse(200, authorizationServerMetadata(ctx.issuer));
    case "/.well-known/oauth-protected-resource":
    case "/.well-known/oauth-protected-resource/mcp":
      return jsonResponse(200, protectedResourceMetadata(ctx.issuer));
    case "/oauth/register":
      return registerClient(req.body);
    case "/oauth/authorize":
      return handleAuthorize(req.url);
    case "/oauth/confirm":
      return handleConfirm(req, ctx);
    case "/oauth/token":
      return handleToken(req, ctx);
    default:
      return null;
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > BODY_LIMIT) {
      throw new Error("payload too large");
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function headerGetter(req: IncomingMessage): (name: string) => string | undefined {
  return (name: string) => firstHeaderValue(req.headers[name.toLowerCase()]);
}

export async function handleOAuthRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: OAuthContext
): Promise<boolean> {
  const path = normalizePath(url.pathname);
  if (!OAUTH_PATHS.has(path)) return false;

  let body = "";
  const method = (req.method || "GET").toUpperCase();
  if (method === "POST") {
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(413, { ...CORS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Payload too large" }));
      return true;
    }
  }

  const result = dispatchOAuth(
    { method, url, header: headerGetter(req), body },
    ctx
  );
  if (!result) return false;

  res.writeHead(result.status, result.headers);
  res.end(result.body);
  return true;
}
