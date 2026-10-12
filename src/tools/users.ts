import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient } from "../client.js";
import { formatResponse, formatError } from "./helpers.js";
import { zOwner, zRepo, zPage, zLimit, zId, zTitle, zBody, zSearchQuery } from "../validation.js";

export function registerUserTools(server: McpServer, client: ForgejoClient): void {
  // 1. get_authenticated_user
  server.tool(
    "get_authenticated_user",
    "Get the currently authenticated user",
    {},
    async () => {
      try {
        const data = await client.get("/user");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 2. get_user
  server.tool(
    "get_user",
    "Get a user's profile by username",
    {
      username: zOwner.describe("Username of the user"),
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 3. list_user_repos
  server.tool(
    "list_user_repos",
    "List repositories owned by a user",
    {
      username: zOwner.describe("Username of the user"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/repos`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 4. list_user_orgs
  server.tool(
    "list_user_orgs",
    "List organizations a user belongs to",
    {
      username: zOwner.describe("Username of the user"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/orgs`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 5. search_users
  server.tool(
    "search_users",
    "Search for users on the Forgejo instance",
    {
      q: zSearchQuery.describe("Search query string"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/users/search", {
          q: params.q,
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 6. list_followers
  server.tool(
    "list_followers",
    "List a user's followers",
    {
      username: zOwner.describe("Username of the user"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/followers`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 7. list_following
  server.tool(
    "list_following",
    "List who a user is following",
    {
      username: zOwner.describe("Username of the user"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/following`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 8. list_user_starred
  server.tool(
    "list_user_starred",
    "List repositories starred by a user",
    {
      username: zOwner.describe("Username of the user"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/starred`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 9. list_my_starred
  server.tool(
    "list_my_starred",
    "List repositories starred by the authenticated user",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/user/starred", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 10. star_repo
  server.tool(
    "star_repo",
    "Star a repository for the authenticated user",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.put(`/user/starred/${params.owner}/${params.repo}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 11. unstar_repo
  server.tool(
    "unstar_repo",
    "Unstar a repository for the authenticated user",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.delete(`/user/starred/${params.owner}/${params.repo}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 12. list_my_notifications
  server.tool(
    "list_my_notifications",
    "List notifications for the authenticated user",
    {
      page: zPage,
      limit: zLimit,
      status_types: z
        .enum(["unread", "read", "pinned"])
        .optional()
        .describe("Filter by status type: unread, read, or pinned"),
    },
    async (params) => {
      try {
        const data = await client.get("/notifications", {
          page: params.page,
          limit: params.limit,
          "status-types": params.status_types,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 13. mark_notifications_read
  server.tool(
    "mark_notifications_read",
    "Mark all notifications as read for the authenticated user",
    {},
    async () => {
      try {
        const data = await client.put("/notifications");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 14. check_new_notifications
  server.tool(
    "check_new_notifications",
    "Check if the authenticated user has unread notifications (returns the unread count)",
    {},
    async () => {
      try {
        const data = await client.get("/notifications/new");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 15. get_notification_thread
  server.tool(
    "get_notification_thread",
    "Get a notification thread by ID",
    {
      id: zId.describe("Notification thread ID"),
    },
    async (params) => {
      try {
        const data = await client.get(`/notifications/threads/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 16. mark_notification_thread_read
  server.tool(
    "mark_notification_thread_read",
    "Mark a notification thread as read (or another status) by ID",
    {
      id: zId.describe("Notification thread ID"),
      to_status: z.enum(["read", "unread", "pinned"]).optional().describe("Status to mark the thread as (default: read)"),
    },
    async (params) => {
      try {
        const data = await client.patch(`/notifications/threads/${params.id}`, undefined, {
          "to-status": params.to_status,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 17. list_repo_notifications
  server.tool(
    "list_repo_notifications",
    "List the authenticated user's notification threads on a specific repository",
    {
      owner: zOwner,
      repo: zRepo,
      all: z.boolean().optional().describe("If true, show notifications marked as read"),
      status_type: z.enum(["read", "unread", "pinned"]).optional().describe("Only show notifications with this status (default: unread and pinned)"),
      subject_type: z.enum(["issue", "pull", "commit", "repository"]).optional().describe("Only show notifications with this subject type"),
      since: z.string().max(64).optional().describe("Only show items updated after this time (RFC 3339)"),
      before: z.string().max(64).optional().describe("Only show items updated before this time (RFC 3339)"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/notifications`, {
          all: params.all,
          "status-types": params.status_type,
          "subject-type": params.subject_type,
          since: params.since,
          before: params.before,
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 18. mark_repo_notifications_read
  server.tool(
    "mark_repo_notifications_read",
    "Mark notification threads on a specific repository as read, pinned or unread",
    {
      owner: zOwner,
      repo: zRepo,
      all: z.boolean().optional().describe("If true, mark all notifications on this repository"),
      status_type: z.enum(["read", "unread", "pinned"]).optional().describe("Only mark notifications with this status (default: unread)"),
      to_status: z.enum(["read", "unread", "pinned"]).optional().describe("Status to mark notifications as (default: read)"),
      last_read_at: z.string().max(64).optional().describe("Only mark notifications updated before this time (RFC 3339, default: now)"),
    },
    async (params) => {
      try {
        const data = await client.put(`/repos/${params.owner}/${params.repo}/notifications`, undefined, {
          all: params.all,
          "status-types": params.status_type,
          "to-status": params.to_status,
          last_read_at: params.last_read_at,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 19. list_my_followers
  server.tool(
    "list_my_followers",
    "List the authenticated user's followers",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/user/followers", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 20. list_my_following
  server.tool(
    "list_my_following",
    "List the users that the authenticated user is following",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/user/following", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 21. check_my_following
  server.tool(
    "check_my_following",
    "Check whether the authenticated user follows a user (succeeds if so, 404 error if not)",
    {
      username: zOwner.describe("Username"),
    },
    async (params) => {
      try {
        const data = await client.get(`/user/following/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 22. follow_user
  server.tool(
    "follow_user",
    "Follow a user",
    {
      username: zOwner.describe("Username"),
    },
    async (params) => {
      try {
        const data = await client.put(`/user/following/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 23. unfollow_user
  server.tool(
    "unfollow_user",
    "Unfollow a user",
    {
      username: zOwner.describe("Username"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/user/following/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 24. check_user_following
  server.tool(
    "check_user_following",
    "Check if one user follows another user (succeeds if so, 404 error if not)",
    {
      username: zOwner.describe("Username"),
      target: zOwner.describe("Username of the user who may be followed"),
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/following/${params.target}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 25. list_my_emails
  server.tool(
    "list_my_emails",
    "List all email addresses of the authenticated user",
    {},
    async () => {
      try {
        const data = await client.get("/user/emails");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 26. add_my_emails
  server.tool(
    "add_my_emails",
    "Add email addresses to the authenticated user's account",
    {
      emails: z.array(z.string().email().max(254)).min(1).describe("Email addresses"),
    },
    async (params) => {
      try {
        const data = await client.post("/user/emails", {
          emails: params.emails,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 27. delete_my_emails
  server.tool(
    "delete_my_emails",
    "Delete email addresses from the authenticated user's account",
    {
      emails: z.array(z.string().email().max(254)).min(1).describe("Email addresses"),
    },
    async (params) => {
      try {
        const data = await client.delete("/user/emails", {
          emails: params.emails,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 28. list_my_ssh_keys
  server.tool(
    "list_my_ssh_keys",
    "List the authenticated user's SSH public keys",
    {
      fingerprint: z.string().max(255).optional().describe("Fingerprint of the key to filter by"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/user/keys", {
          fingerprint: params.fingerprint,
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 29. create_my_ssh_key
  server.tool(
    "create_my_ssh_key",
    "Add an SSH public key to the authenticated user's account",
    {
      title: zTitle.describe("Title of the key"),
      key: z.string().min(1).max(16384).describe("Armored SSH public key"),
      read_only: z.boolean().optional().describe("Whether the key has only read access"),
    },
    async (params) => {
      try {
        const data = await client.post("/user/keys", {
          title: params.title,
          key: params.key,
          read_only: params.read_only,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 30. get_my_ssh_key
  server.tool(
    "get_my_ssh_key",
    "Get one of the authenticated user's SSH public keys",
    {
      id: zId.describe("Key ID"),
    },
    async (params) => {
      try {
        const data = await client.get(`/user/keys/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 31. delete_my_ssh_key
  server.tool(
    "delete_my_ssh_key",
    "Delete an SSH public key from the authenticated user's account",
    {
      id: zId.describe("Key ID"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/user/keys/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 32. list_user_ssh_keys
  server.tool(
    "list_user_ssh_keys",
    "List a user's SSH public keys",
    {
      username: zOwner.describe("Username"),
      fingerprint: z.string().max(255).optional().describe("Fingerprint of the key to filter by"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/keys`, {
          fingerprint: params.fingerprint,
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 33. list_my_gpg_keys
  server.tool(
    "list_my_gpg_keys",
    "List the authenticated user's GPG keys",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/user/gpg_keys", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 34. add_my_gpg_key
  server.tool(
    "add_my_gpg_key",
    "Add a GPG public key to the authenticated user's account",
    {
      armored_public_key: z.string().min(1).max(65536).describe("Armored GPG public key"),
      armored_signature: z.string().max(65536).optional().describe("Armored signature of the verification token, to verify the key"),
    },
    async (params) => {
      try {
        const data = await client.post("/user/gpg_keys", {
          armored_public_key: params.armored_public_key,
          armored_signature: params.armored_signature,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 35. get_my_gpg_key
  server.tool(
    "get_my_gpg_key",
    "Get one of the authenticated user's GPG keys",
    {
      id: zId.describe("GPG key ID"),
    },
    async (params) => {
      try {
        const data = await client.get(`/user/gpg_keys/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 36. delete_my_gpg_key
  server.tool(
    "delete_my_gpg_key",
    "Remove a GPG public key from the authenticated user's account",
    {
      id: zId.describe("GPG key ID"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/user/gpg_keys/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 37. get_gpg_key_verification_token
  server.tool(
    "get_gpg_key_verification_token",
    "Get a token to sign in order to verify a GPG key",
    {},
    async () => {
      try {
        const data = await client.get("/user/gpg_key_token");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 38. verify_my_gpg_key
  server.tool(
    "verify_my_gpg_key",
    "Verify one of the authenticated user's GPG keys with a signed verification token",
    {
      key_id: z.string().min(1).max(255).describe("ID of the GPG key to verify"),
      armored_signature: z.string().max(65536).optional().describe("Armored signature of the verification token"),
    },
    async (params) => {
      try {
        const data = await client.post("/user/gpg_key_verify", {
          key_id: params.key_id,
          armored_signature: params.armored_signature,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 39. list_user_gpg_keys
  server.tool(
    "list_user_gpg_keys",
    "List a user's GPG keys",
    {
      username: zOwner.describe("Username"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/gpg_keys`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 40. list_my_hooks
  server.tool(
    "list_my_hooks",
    "List the authenticated user's webhooks",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/user/hooks", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 41. create_my_hook
  server.tool(
    "create_my_hook",
    "Create a webhook for the authenticated user",
    {
      type: z.enum(["forgejo", "dingtalk", "discord", "gitea", "gogs", "msteams", "slack", "telegram", "feishu", "wechatwork", "packagist"]).describe("Webhook type"),
      config: z.record(z.string()).describe("Hook configuration, e.g. { url, content_type: \"json\", secret }"),
      events: z.array(z.string()).optional().describe("Events that trigger the hook (e.g. push, issues, pull_request)"),
      active: z.boolean().optional().describe("Whether the hook is active"),
      branch_filter: z.string().max(255).optional().describe("Branch filter glob"),
      authorization_header: z.string().max(2048).optional().describe("Authorization header sent with the webhook"),
    },
    async (params) => {
      try {
        const data = await client.post("/user/hooks", {
          type: params.type,
          config: params.config,
          events: params.events,
          active: params.active,
          branch_filter: params.branch_filter,
          authorization_header: params.authorization_header,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 42. get_my_hook
  server.tool(
    "get_my_hook",
    "Get one of the authenticated user's webhooks",
    {
      id: zId.describe("Hook ID"),
    },
    async (params) => {
      try {
        const data = await client.get(`/user/hooks/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 43. edit_my_hook
  server.tool(
    "edit_my_hook",
    "Update one of the authenticated user's webhooks",
    {
      id: zId.describe("Hook ID"),
      config: z.record(z.string()).optional().describe("Hook configuration, e.g. { url, content_type, secret }"),
      events: z.array(z.string()).optional().describe("Events that trigger the hook"),
      active: z.boolean().optional().describe("Whether the hook is active"),
      branch_filter: z.string().max(255).optional().describe("Branch filter glob"),
      authorization_header: z.string().max(2048).optional().describe("Authorization header sent with the webhook"),
    },
    async (params) => {
      try {
        const data = await client.patch(`/user/hooks/${params.id}`, {
          config: params.config,
          events: params.events,
          active: params.active,
          branch_filter: params.branch_filter,
          authorization_header: params.authorization_header,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 44. delete_my_hook
  server.tool(
    "delete_my_hook",
    "Delete one of the authenticated user's webhooks",
    {
      id: zId.describe("Hook ID"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/user/hooks/${params.id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 45. list_my_blocked_users
  server.tool(
    "list_my_blocked_users",
    "List the users blocked by the authenticated user",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/user/list_blocked", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 46. block_user
  server.tool(
    "block_user",
    "Block a user as the authenticated user",
    {
      username: zOwner.describe("Username"),
    },
    async (params) => {
      try {
        const data = await client.put(`/user/block/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 47. unblock_user
  server.tool(
    "unblock_user",
    "Unblock a user as the authenticated user",
    {
      username: zOwner.describe("Username"),
    },
    async (params) => {
      try {
        const data = await client.put(`/user/unblock/${params.username}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 48. get_my_quota
  server.tool(
    "get_my_quota",
    "Get quota information for the authenticated user",
    {},
    async () => {
      try {
        const data = await client.get("/user/quota");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 49. list_my_quota_artifacts
  server.tool(
    "list_my_quota_artifacts",
    "List the artifacts affecting the authenticated user's quota",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/user/quota/artifacts", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 50. list_my_quota_attachments
  server.tool(
    "list_my_quota_attachments",
    "List the attachments affecting the authenticated user's quota",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/user/quota/attachments", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 51. list_my_quota_packages
  server.tool(
    "list_my_quota_packages",
    "List the packages affecting the authenticated user's quota",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/user/quota/packages", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 52. check_my_quota
  server.tool(
    "check_my_quota",
    "Check if the authenticated user is over quota for a given subject",
    {
      subject: z.string().min(1).max(255).describe("Quota subject to check, e.g. size:all, size:repos:all, size:git:all, size:assets:packages:all"),
    },
    async (params) => {
      try {
        const data = await client.get("/user/quota/check", {
          subject: params.subject,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 53. list_my_repos
  server.tool(
    "list_my_repos",
    "List the repositories that the authenticated user owns",
    {
      page: zPage,
      limit: zLimit,
      order_by: z.enum(["name", "id", "newest", "oldest", "recentupdate", "leastupdate", "reversealphabetically", "alphabetically", "reversesize", "size", "reversegitsize", "gitsize", "reverselfssize", "lfssize", "moststars", "feweststars", "mostforks", "fewestforks"]).optional().describe("Order the repositories by this attribute"),
    },
    async (params) => {
      try {
        const data = await client.get("/user/repos", {
          page: params.page,
          limit: params.limit,
          order_by: params.order_by,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 54. get_my_settings
  server.tool(
    "get_my_settings",
    "Get the authenticated user's account settings",
    {},
    async () => {
      try {
        const data = await client.get("/user/settings");
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 55. update_my_settings
  server.tool(
    "update_my_settings",
    "Update the authenticated user's account settings",
    {
      full_name: z.string().max(255).optional().describe("Full name"),
      description: zBody.optional().describe("Profile description/bio"),
      website: z.string().max(255).optional().describe("Website URL"),
      location: z.string().max(255).optional().describe("Location"),
      pronouns: z.string().max(255).optional().describe("Pronouns"),
      language: z.string().max(32).optional().describe("UI language, e.g. en-US"),
      theme: z.string().max(255).optional().describe("UI theme name"),
      diff_view_style: z.string().max(32).optional().describe("Diff view style: unified or split"),
      hide_email: z.boolean().optional().describe("Hide email address from the profile"),
      hide_activity: z.boolean().optional().describe("Hide activity from the profile"),
      hide_pronouns: z.boolean().optional().describe("Hide pronouns from the profile"),
      enable_repo_unit_hints: z.boolean().optional().describe("Show hints about enabling repository units"),
    },
    async (params) => {
      try {
        const data = await client.patch("/user/settings", {
          full_name: params.full_name,
          description: params.description,
          website: params.website,
          location: params.location,
          pronouns: params.pronouns,
          language: params.language,
          theme: params.theme,
          diff_view_style: params.diff_view_style,
          hide_email: params.hide_email,
          hide_activity: params.hide_activity,
          hide_pronouns: params.hide_pronouns,
          enable_repo_unit_hints: params.enable_repo_unit_hints,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 56. check_repo_starred
  server.tool(
    "check_repo_starred",
    "Check whether the authenticated user has starred a repository (succeeds if so, 404 error if not)",
    {
      owner: zOwner,
      repo: zRepo,
    },
    async (params) => {
      try {
        const data = await client.get(`/user/starred/${params.owner}/${params.repo}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 57. list_my_stopwatches
  server.tool(
    "list_my_stopwatches",
    "List the authenticated user's running stopwatches",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/user/stopwatches", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 58. list_my_subscriptions
  server.tool(
    "list_my_subscriptions",
    "List the repositories watched by the authenticated user",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/user/subscriptions", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 59. list_user_subscriptions
  server.tool(
    "list_user_subscriptions",
    "List the repositories watched by a user",
    {
      username: zOwner.describe("Username"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/subscriptions`, {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 60. list_my_teams
  server.tool(
    "list_my_teams",
    "List all the teams the authenticated user belongs to",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get("/user/teams", {
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 61. list_my_tracked_times
  server.tool(
    "list_my_tracked_times",
    "List the authenticated user's tracked times",
    {
      page: zPage,
      limit: zLimit,
      since: z.string().max(64).optional().describe("Only show items updated after this time (RFC 3339)"),
      before: z.string().max(64).optional().describe("Only show items updated before this time (RFC 3339)"),
    },
    async (params) => {
      try {
        const data = await client.get("/user/times", {
          page: params.page,
          limit: params.limit,
          since: params.since,
          before: params.before,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 62. list_user_activity_feeds
  server.tool(
    "list_user_activity_feeds",
    "List a user's activity feeds",
    {
      username: zOwner.describe("Username"),
      only_performed_by: z.boolean().optional().describe("If true, only show actions performed by the requested user"),
      date: z.string().max(32).optional().describe("Only show activity on this date (YYYY-MM-DD)"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/activities/feeds`, {
          "only-performed-by": params.only_performed_by,
          date: params.date,
          page: params.page,
          limit: params.limit,
        });
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 63. get_user_heatmap
  server.tool(
    "get_user_heatmap",
    "Get a user's contribution heatmap",
    {
      username: zOwner.describe("Username"),
    },
    async (params) => {
      try {
        const data = await client.get(`/users/${params.username}/heatmap`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
