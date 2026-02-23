import { z } from "zod";

/**
 * Reusable validation schemas for path segments and common parameters.
 * Prevents path traversal, injection, and ensures sane bounds.
 */

// Path segment pattern: alphanumeric, hyphens, underscores, dots (no slashes, no ..)
const PATH_SEGMENT_REGEX = /^[a-zA-Z0-9_.-]+$/;

/** Validates a username/owner/org path segment */
export const zOwner = z
  .string()
  .min(1)
  .max(255)
  .regex(PATH_SEGMENT_REGEX, "Invalid characters in owner/username. Only alphanumeric, hyphens, underscores, and dots are allowed.")
  .describe("Owner/username");

/** Validates a repository name path segment */
export const zRepo = z
  .string()
  .min(1)
  .max(255)
  .regex(PATH_SEGMENT_REGEX, "Invalid characters in repository name. Only alphanumeric, hyphens, underscores, and dots are allowed.")
  .describe("Repository name");

/** Validates a branch name (allows slashes for namespaced branches like feature/foo) */
export const zBranch = z
  .string()
  .min(1)
  .max(255)
  .refine((val) => !val.includes(".."), "Branch name must not contain '..'")
  .refine((val) => !val.startsWith("/") && !val.endsWith("/"), "Branch name must not start or end with '/'")
  .describe("Branch name");

/** Validates a file path within a repo (allows slashes, blocks traversal) */
export const zFilePath = z
  .string()
  .min(1)
  .max(4096)
  .refine((val) => !val.includes(".."), "File path must not contain '..' (path traversal)")
  .refine((val) => !val.startsWith("/"), "File path must not start with '/'")
  .refine((val) => !val.includes("\\"), "File path must not contain backslashes")
  .describe("File path in the repository");

/** Validates a template/task name */
export const zTemplateName = z
  .string()
  .min(1)
  .max(255)
  .regex(PATH_SEGMENT_REGEX, "Invalid characters in name. Only alphanumeric, hyphens, underscores, and dots are allowed.");

/** Pagination: page number */
export const zPage = z.number().int().min(1).optional().describe("Page number (starts at 1)");

/** Pagination: limit */
export const zLimit = z.number().int().min(1).max(50).optional().describe("Number of results per page (max 50)");

/** Positive integer ID */
export const zId = z.number().int().positive().describe("Numeric ID");

/** Positive integer index (issue/PR number) */
export const zIndex = z.number().int().positive().describe("Issue or PR number");

/** Short text fields (titles, names) */
export const zTitle = z.string().min(1).max(255);

/** Long text fields (bodies, descriptions) */
export const zBody = z.string().max(65536);

/** Search query */
export const zSearchQuery = z.string().max(256);

/** SHA hash */
export const zSha = z.string().min(4).max(64).regex(/^[a-fA-F0-9]+$/, "Must be a valid hex SHA");

/** Enum validators */
export const zState = z.enum(["open", "closed", "all"]).optional();
export const zVisibility = z.enum(["public", "limited", "private"]).optional();
export const zPermission = z.enum(["read", "write", "admin"]).optional();
export const zMergeMethod = z.enum(["merge", "rebase", "rebase-merge", "squash"]).default("merge");
export const zReviewEvent = z.enum(["APPROVED", "REQUEST_CHANGES", "COMMENT"]);
export const zMarkdownMode = z.enum(["gfm", "comment", "plain"]).optional();
