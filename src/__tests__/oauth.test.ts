import { createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_TTL_MS,
  CLIENT_ID,
  CODE_TTL_MS,
  OAUTH_SCOPE,
  authorizationServerMetadata,
  dispatchOAuth,
  isValidBearer,
  protectedResourceMetadata,
  resetOAuthReplayCache,
  resolveIssuer,
  signToken,
  unauthorizedHeaders,
  verifyToken,
  type OAuthContext,
  type OAuthRequest,
} from "../oauth.js";

const SECRET = "test-api-key-that-is-long-enough";
const ISSUER = "https://mcp.example.com";
const ctx: OAuthContext = { secret: SECRET, issuer: ISSUER };
const REDIRECT = "https://grok.com/oauth/callback";

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function req(opts: {
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: string;
  contentType?: string;
}): OAuthRequest {
  const url = new URL(opts.path, ISSUER);
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    url.searchParams.set(key, value);
  }
  return {
    method: opts.method,
    url,
    header: (name) => (name.toLowerCase() === "content-type" ? opts.contentType : undefined),
    body: opts.body ?? "",
  };
}

function json(res: { body: string }) {
  return JSON.parse(res.body) as Record<string, unknown>;
}

beforeEach(() => {
  resetOAuthReplayCache();
});

afterEach(() => {
  resetOAuthReplayCache();
});

describe("metadata", () => {
  it("advertises authorization-code + PKCE + DCR", () => {
    const meta = authorizationServerMetadata(ISSUER);
    expect(meta.issuer).toBe(ISSUER);
    expect(meta.authorization_endpoint).toBe(`${ISSUER}/oauth/authorize`);
    expect(meta.token_endpoint).toBe(`${ISSUER}/oauth/token`);
    expect(meta.registration_endpoint).toBe(`${ISSUER}/oauth/register`);
    expect(meta.response_types_supported).toEqual(["code"]);
    expect(meta.grant_types_supported).toEqual(["authorization_code", "refresh_token"]);
    expect(meta.code_challenge_methods_supported).toEqual(["S256"]);
    expect(meta.token_endpoint_auth_methods_supported).toEqual(["none"]);
    expect(meta.scopes_supported).toEqual([OAUTH_SCOPE]);
  });

  it("points protected-resource metadata at /mcp", () => {
    const meta = protectedResourceMetadata(ISSUER);
    expect(meta.resource).toBe(`${ISSUER}/mcp`);
    expect(meta.authorization_servers).toEqual([ISSUER]);
    expect(meta.bearer_methods_supported).toEqual(["header"]);
  });

  it("serves both well-known documents", () => {
    const as = dispatchOAuth(req({ method: "GET", path: "/.well-known/oauth-authorization-server" }), ctx);
    const prm = dispatchOAuth(req({ method: "GET", path: "/.well-known/oauth-protected-resource" }), ctx);
    const prmPath = dispatchOAuth(req({ method: "GET", path: "/.well-known/oauth-protected-resource/mcp" }), ctx);

    expect(as?.status).toBe(200);
    expect(prm?.status).toBe(200);
    expect(prmPath?.status).toBe(200);
    expect(json(as!).issuer).toBe(ISSUER);
    expect(json(prm!).resource).toBe(`${ISSUER}/mcp`);
    expect(json(prmPath!).resource).toBe(`${ISSUER}/mcp`);
  });

  it("includes resource_metadata on 401 challenges", () => {
    const headers = unauthorizedHeaders(ISSUER);
    expect(headers["WWW-Authenticate"]).toContain(
      `resource_metadata="${ISSUER}/.well-known/oauth-protected-resource"`
    );
  });
});

describe("resolveIssuer", () => {
  it("prefers OAUTH_PUBLIC_URL over request headers", () => {
    expect(
      resolveIssuer(
        { host: "localhost:3000", "x-forwarded-host": "tunnel.example", "x-forwarded-proto": "https" },
        "https://forced.example/"
      )
    ).toBe("https://forced.example");
  });

  it("uses X-Forwarded-* when no public URL is set", () => {
    expect(
      resolveIssuer({
        host: "localhost:3000",
        "x-forwarded-host": "a1b2.ngrok-free.app",
        "x-forwarded-proto": "https,http",
      })
    ).toBe("https://a1b2.ngrok-free.app");
  });

  it("falls back to Host", () => {
    expect(resolveIssuer({ host: "localhost:3000" })).toBe("http://localhost:3000");
  });
});

describe("dynamic client registration", () => {
  it("returns a public client with no secret", () => {
    const res = dispatchOAuth(
      req({
        method: "POST",
        path: "/oauth/register",
        contentType: "application/json",
        body: JSON.stringify({
          client_name: "Grok",
          redirect_uris: [REDIRECT],
          token_endpoint_auth_method: "none",
        }),
      }),
      ctx
    );
    expect(res?.status).toBe(201);
    const body = json(res!);
    expect(body.client_id).toBe(CLIENT_ID);
    expect(body.client_secret).toBeUndefined();
    expect(body.token_endpoint_auth_method).toBe("none");
    expect(body.redirect_uris).toEqual([REDIRECT]);
  });
});

describe("authorization code + PKCE", () => {
  async function completeFlow(verifier = pkce(), password = SECRET) {
    const authorize = dispatchOAuth(
      req({
        method: "GET",
        path: "/oauth/authorize",
        query: {
          response_type: "code",
          client_id: CLIENT_ID,
          redirect_uri: REDIRECT,
          state: "abc",
          code_challenge: verifier.challenge,
          code_challenge_method: "S256",
        },
      }),
      ctx
    );
    expect(authorize?.status).toBe(200);
    expect(authorize?.headers["Content-Type"]).toContain("text/html");
    expect(authorize?.body).toContain("name=\"password\"");

    const confirm = dispatchOAuth(
      req({
        method: "POST",
        path: "/oauth/confirm",
        contentType: "application/x-www-form-urlencoded",
        body: new URLSearchParams({
          password,
          redirect_uri: REDIRECT,
          state: "abc",
          code_challenge: verifier.challenge,
        }).toString(),
      }),
      ctx
    );
    return { verifier, authorize, confirm };
  }

  it("shows a password-gated consent page", async () => {
    const { confirm } = await completeFlow();
    expect(confirm?.status).toBe(302);
    const location = new URL(confirm!.headers.Location);
    expect(location.origin + location.pathname).toBe(REDIRECT);
    expect(location.searchParams.get("state")).toBe("abc");
    expect(location.searchParams.get("code")).toBeTruthy();
  });

  it("does not issue a code without the API key", async () => {
    const { confirm } = await completeFlow(pkce(), "wrong-password");
    expect(confirm?.status).toBe(401);
    expect(confirm?.headers.Location).toBeUndefined();
    expect(confirm?.body).toContain("Invalid API key");
  });

  it("exchanges a valid PKCE code for tokens", async () => {
    const verifier = pkce();
    const { confirm } = await completeFlow(verifier);
    const code = new URL(confirm!.headers.Location).searchParams.get("code")!;

    const token = dispatchOAuth(
      req({
        method: "POST",
        path: "/oauth/token",
        contentType: "application/x-www-form-urlencoded",
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT,
          code_verifier: verifier.verifier,
        }).toString(),
      }),
      ctx
    );
    expect(token?.status).toBe(200);
    const body = json(token!);
    expect(typeof body.access_token).toBe("string");
    expect(typeof body.refresh_token).toBe("string");
    expect(body.token_type).toBe("Bearer");
    expect(body.expires_in).toBe(Math.floor(ACCESS_TOKEN_TTL_MS / 1000));
    expect(isValidBearer(SECRET, body.access_token as string)).toBe(true);
  });

  it("rejects a bad PKCE verifier", async () => {
    const { confirm } = await completeFlow();
    const code = new URL(confirm!.headers.Location).searchParams.get("code")!;
    const token = dispatchOAuth(
      req({
        method: "POST",
        path: "/oauth/token",
        contentType: "application/x-www-form-urlencoded",
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT,
          code_verifier: "not-the-verifier",
        }).toString(),
      }),
      ctx
    );
    expect(token?.status).toBe(400);
    expect(json(token!).error).toBe("invalid_grant");
  });

  it("rejects a redirect_uri mismatch", async () => {
    const verifier = pkce();
    const { confirm } = await completeFlow(verifier);
    const code = new URL(confirm!.headers.Location).searchParams.get("code")!;
    const token = dispatchOAuth(
      req({
        method: "POST",
        path: "/oauth/token",
        contentType: "application/x-www-form-urlencoded",
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: "https://evil.example/callback",
          code_verifier: verifier.verifier,
        }).toString(),
      }),
      ctx
    );
    expect(token?.status).toBe(400);
    expect(json(token!).error_description).toMatch(/redirect_uri/i);
  });

  it("rejects a reused authorization code", async () => {
    const verifier = pkce();
    const { confirm } = await completeFlow(verifier);
    const code = new URL(confirm!.headers.Location).searchParams.get("code")!;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
      code_verifier: verifier.verifier,
    }).toString();

    const first = dispatchOAuth(
      req({ method: "POST", path: "/oauth/token", contentType: "application/x-www-form-urlencoded", body }),
      ctx
    );
    const second = dispatchOAuth(
      req({ method: "POST", path: "/oauth/token", contentType: "application/x-www-form-urlencoded", body }),
      ctx
    );
    expect(first?.status).toBe(200);
    expect(second?.status).toBe(400);
  });

  it("rejects an expired authorization code", () => {
    const now = Date.now();
    const expired = signToken(SECRET, "c", {
      iat: now - CODE_TTL_MS * 2,
      exp: now - 1,
      jti: "expired",
      redirect_uri: REDIRECT,
      code_challenge: pkce().challenge,
    });
    expect(verifyToken(SECRET, "c", expired)).toBeNull();
  });

  it("rejects javascript: redirect URIs", () => {
    const res = dispatchOAuth(
      req({
        method: "GET",
        path: "/oauth/authorize",
        query: {
          response_type: "code",
          redirect_uri: "javascript:alert(1)",
          code_challenge: "abc",
          code_challenge_method: "S256",
        },
      }),
      ctx
    );
    expect(res?.status).toBe(400);
    expect(res?.headers.Location).toBeUndefined();
  });
});

describe("refresh tokens", () => {
  function tokensFromCode() {
    const verifier = pkce();
    const now = Date.now();
    const code = signToken(SECRET, "c", {
      iat: now,
      exp: now + CODE_TTL_MS,
      jti: randomBytes(8).toString("hex"),
      redirect_uri: REDIRECT,
      code_challenge: verifier.challenge,
    });
    const token = dispatchOAuth(
      req({
        method: "POST",
        path: "/oauth/token",
        contentType: "application/json",
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT,
          code_verifier: verifier.verifier,
        }),
      }),
      ctx
    );
    return json(token!);
  }

  it("rotates refresh tokens and rejects reuse", () => {
    const initial = tokensFromCode();
    const refresh = dispatchOAuth(
      req({
        method: "POST",
        path: "/oauth/token",
        contentType: "application/x-www-form-urlencoded",
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: initial.refresh_token as string,
        }).toString(),
      }),
      ctx
    );
    expect(refresh?.status).toBe(200);
    const rotated = json(refresh!);
    expect(rotated.access_token).not.toBe(initial.access_token);
    expect(rotated.refresh_token).not.toBe(initial.refresh_token);
    expect(isValidBearer(SECRET, rotated.access_token as string)).toBe(true);

    const replay = dispatchOAuth(
      req({
        method: "POST",
        path: "/oauth/token",
        contentType: "application/x-www-form-urlencoded",
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: initial.refresh_token as string,
        }).toString(),
      }),
      ctx
    );
    expect(replay?.status).toBe(400);
  });
});

describe("isValidBearer", () => {
  it("accepts the static API key", () => {
    expect(isValidBearer(SECRET, SECRET)).toBe(true);
  });

  it("accepts a valid access token", () => {
    const token = signToken(SECRET, "a", {
      iat: Date.now(),
      exp: Date.now() + ACCESS_TOKEN_TTL_MS,
      jti: "1",
    });
    expect(isValidBearer(SECRET, token)).toBe(true);
  });

  it("rejects a refresh token as a bearer credential", () => {
    const token = signToken(SECRET, "r", {
      iat: Date.now(),
      exp: Date.now() + ACCESS_TOKEN_TTL_MS,
      jti: "1",
    });
    expect(isValidBearer(SECRET, token)).toBe(false);
  });

  it("rejects expired and tampered tokens", () => {
    const expired = signToken(SECRET, "a", {
      iat: 1,
      exp: 2,
      jti: "old",
    });
    const valid = signToken(SECRET, "a", {
      iat: Date.now(),
      exp: Date.now() + ACCESS_TOKEN_TTL_MS,
      jti: "ok",
    });
    const tampered = valid.slice(0, -1) + (valid.endsWith("a") ? "b" : "a");
    expect(isValidBearer(SECRET, expired)).toBe(false);
    expect(isValidBearer(SECRET, tampered)).toBe(false);
    expect(isValidBearer(SECRET, "")).toBe(false);
    expect(isValidBearer(SECRET, "nope")).toBe(false);
  });
});

describe("CORS and methods", () => {
  it("answers OPTIONS on OAuth routes", () => {
    const res = dispatchOAuth(req({ method: "OPTIONS", path: "/oauth/token" }), ctx);
    expect(res?.status).toBe(204);
    expect(res?.headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("rejects GET on the token endpoint", () => {
    const res = dispatchOAuth(req({ method: "GET", path: "/oauth/token" }), ctx);
    expect(res?.status).toBe(405);
  });

  it("ignores unrelated paths", () => {
    expect(dispatchOAuth(req({ method: "GET", path: "/mcp" }), ctx)).toBeNull();
    expect(dispatchOAuth(req({ method: "GET", path: "/health" }), ctx)).toBeNull();
  });
});
