import { describe, it, expect } from "vitest";
import {
  encodeFileContent,
  decodeContentsResponse,
  slimFileWriteResponse,
} from "../../tools/file-content.js";

describe("encodeFileContent", () => {
  it("encodes UTF-8 text as standard base64", () => {
    expect(encodeFileContent("hello")).toBe("aGVsbG8=");
  });

  it("encodes unicode", () => {
    expect(encodeFileContent("héllo 🎉")).toBe(
      Buffer.from("héllo 🎉", "utf8").toString("base64")
    );
  });

  it("encodes an empty string", () => {
    expect(encodeFileContent("")).toBe("");
  });
});

describe("decodeContentsResponse", () => {
  it("decodes a base64 text file to utf-8", () => {
    const result = decodeContentsResponse({
      name: "README.md",
      path: "README.md",
      sha: "abc",
      type: "file",
      size: 5,
      encoding: "base64",
      content: "aGVsbG8=",
    });

    expect(result).toMatchObject({
      sha: "abc",
      encoding: "utf-8",
      content: "hello",
    });
  });

  it("strips newlines from wrapped base64 before decoding", () => {
    const wrapped = "aGVs\nbG8=";
    const result = decodeContentsResponse({
      encoding: "base64",
      content: wrapped,
      type: "file",
      size: 5,
    }) as { content: string; encoding: string };

    expect(result.content).toBe("hello");
    expect(result.encoding).toBe("utf-8");
  });

  it("treats empty files as utf-8 empty string", () => {
    const result = decodeContentsResponse({
      encoding: "base64",
      content: null,
      size: 0,
      type: "file",
    }) as { content: string; encoding: string };

    expect(result.content).toBe("");
    expect(result.encoding).toBe("utf-8");
  });

  it("keeps binary files as base64", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const encoded = png.toString("base64");
    const result = decodeContentsResponse({
      encoding: "base64",
      content: encoded,
      type: "file",
      size: png.length,
    }) as { content: string; encoding: string };

    expect(result.encoding).toBe("base64");
    expect(result.content).toBe(encoded);
  });

  it("keeps NUL-containing payloads as base64", () => {
    const bytes = Buffer.from("hello\0world", "utf8");
    const encoded = bytes.toString("base64");
    const result = decodeContentsResponse({
      encoding: "base64",
      content: encoded,
      type: "file",
      size: bytes.length,
    }) as { encoding: string; content: string };

    expect(result.encoding).toBe("base64");
    expect(result.content).toBe(encoded);
  });

  it("leaves directory listings unchanged", () => {
    const listing = [
      { name: "src", type: "dir" },
      { name: "README.md", type: "file" },
    ];
    expect(decodeContentsResponse(listing)).toEqual(listing);
  });

  it("leaves non-base64 encoding unchanged", () => {
    const file = { encoding: "utf-8", content: "already decoded", sha: "x" };
    expect(decodeContentsResponse(file)).toEqual(file);
  });

  it("leaves large files with omitted content unchanged", () => {
    const file = { encoding: "base64", content: null, size: 2_000_000, sha: "x" };
    expect(decodeContentsResponse(file)).toEqual(file);
  });
});

describe("slimFileWriteResponse", () => {
  it("keeps path/sha/size and drops the echoed file body", () => {
    const result = slimFileWriteResponse({
      content: {
        name: "README.md",
        path: "README.md",
        sha: "abc123",
        size: 5,
        encoding: "base64",
        content: "aGVsbG8=",
        html_url: "https://example.com/README.md",
        url: "https://example.com/api/v1/repos/u/r/contents/README.md",
        git_url: "https://example.com/api/v1/repos/u/r/git/blobs/abc123",
      },
      commit: {
        sha: "def456",
        message: "add readme",
        html_url: "https://example.com/commit/def456",
        author: { name: "A", email: "a@b.c", date: "2026-01-01T00:00:00Z" },
        parents: [{ sha: "000" }],
        verification: { verified: false },
        tree: { sha: "ttt" },
      },
    });

    expect(result).toEqual({
      content: {
        name: "README.md",
        path: "README.md",
        sha: "abc123",
        size: 5,
        html_url: "https://example.com/README.md",
      },
      commit: {
        sha: "def456",
        message: "add readme",
        html_url: "https://example.com/commit/def456",
        author: { name: "A", email: "a@b.c", date: "2026-01-01T00:00:00Z" },
      },
    });
  });

  it("passes through non-objects", () => {
    expect(slimFileWriteResponse(undefined)).toBeUndefined();
    expect(slimFileWriteResponse("ok")).toBe("ok");
  });
});
