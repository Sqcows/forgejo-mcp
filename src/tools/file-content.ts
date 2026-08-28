/**
 * Translate between MCP file bodies (plain UTF-8) and the Forgejo/Gitea
 * Contents API, which requires base64 on the wire — matching GitHub MCP.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (obj[key] !== undefined) {
      out[key] = obj[key];
    }
  }
  return out;
}

/** True when bytes are valid UTF-8 text (no NUL). Binary stays base64. */
function isTextBytes(bytes: Buffer): boolean {
  if (bytes.includes(0)) {
    return false;
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/** Encode a UTF-8 file body for POST/PUT /contents/{filepath}. */
export function encodeFileContent(content: string): string {
  return Buffer.from(content, "utf8").toString("base64");
}

/**
 * Decode a Contents API file object for MCP clients.
 * Directory listings (arrays) are returned unchanged.
 * Text files become encoding "utf-8" with decoded content; binary files keep
 * encoding "base64".
 */
export function decodeContentsResponse(data: unknown): unknown {
  if (Array.isArray(data) || !isRecord(data)) {
    return data;
  }
  return decodeFileContents(data);
}

function decodeFileContents(file: Record<string, unknown>): Record<string, unknown> {
  if (file.encoding !== "base64") {
    return file;
  }

  const raw = file.content;
  if (raw == null || raw === "") {
    if (file.size === 0 || file.size === undefined) {
      return { ...file, content: "", encoding: "utf-8" };
    }
    return file;
  }

  if (typeof raw !== "string") {
    return file;
  }

  const compact = raw.replace(/\s+/g, "");
  const bytes = Buffer.from(compact, "base64");

  if (!isTextBytes(bytes)) {
    return { ...file, content: compact, encoding: "base64" };
  }

  return { ...file, content: bytes.toString("utf8"), encoding: "utf-8" };
}

/**
 * Strip the echoed file body (and other Contents API noise) from create/update
 * responses so the model is not handed the base64 payload it just wrote.
 */
export function slimFileWriteResponse(data: unknown): unknown {
  if (!isRecord(data)) {
    return data;
  }

  const result: Record<string, unknown> = {};

  if (isRecord(data.content)) {
    result.content = pick(data.content, ["name", "path", "sha", "size", "html_url"]);
  } else if ("content" in data) {
    result.content = data.content;
  }

  if (isRecord(data.commit)) {
    const commit = pick(data.commit, ["sha", "message", "html_url"]);
    if (isRecord(data.commit.author)) {
      commit.author = pick(data.commit.author, ["name", "email", "date"]);
    }
    result.commit = commit;
  }

  return result;
}
