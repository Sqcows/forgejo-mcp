import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient } from "../client.js";
import { formatResponse, formatError } from "./helpers.js";
import { zOwner, zRepo, zPage, zLimit, zId, zName, zRef, zSha, zTitle, zBody, zSecretName } from "../validation.js";

const zRunStatus = z.enum(["unknown", "waiting", "running", "success", "failure", "cancelled", "skipped", "blocked"]);

/** Secret values can be larger than a normal body field (certificates, keys) */
const zSecretData = z.string().min(1).max(65536);

export function registerActionsTools(server: McpServer, client: ForgejoClient): void {
  // ── Workflow runs, jobs, artifacts, and tasks ─────────────────────────

  // 1. list_action_runs
  server.tool(
    "list_action_runs",
    "List a repository's Actions workflow runs",
    {
      owner: zOwner,
      repo: zRepo,
      event: z.array(z.string().max(100)).optional().describe("Only return runs triggered by these events, e.g. push, pull_request, workflow_dispatch"),
      status: z.array(zRunStatus).optional().describe("Only return runs with these statuses"),
      run_number: z.number().int().positive().optional().describe("Only return the run with this run number"),
      head_sha: zSha.optional().describe("Only return runs associated with this head commit SHA"),
      ref: zRef.optional().describe("Only return runs involving this Git reference, e.g. refs/heads/main"),
      workflow_id: z.string().max(255).optional().describe("Only return runs of this workflow ID (workflow file name)"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/actions/runs`,
          {
            event: params.event,
            status: params.status,
            run_number: params.run_number,
            head_sha: params.head_sha,
            ref: params.ref,
            workflow_id: params.workflow_id,
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 2. get_action_run
  server.tool(
    "get_action_run",
    "Get a single Actions workflow run",
    {
      owner: zOwner,
      repo: zRepo,
      run_id: zId.describe("ID of the workflow run"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/actions/runs/${params.run_id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 3. delete_action_run
  server.tool(
    "delete_action_run",
    "Delete a completed Actions workflow run",
    {
      owner: zOwner,
      repo: zRepo,
      run_id: zId.describe("ID of the workflow run"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/repos/${params.owner}/${params.repo}/actions/runs/${params.run_id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 4. cancel_action_run
  server.tool(
    "cancel_action_run",
    "Cancel a pending or running Actions workflow run",
    {
      owner: zOwner,
      repo: zRepo,
      run_id: zId.describe("ID of the workflow run"),
    },
    async (params) => {
      try {
        const data = await client.post(`/repos/${params.owner}/${params.repo}/actions/runs/${params.run_id}/cancel`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 5. list_action_run_jobs
  server.tool(
    "list_action_run_jobs",
    "List the jobs of an Actions workflow run",
    {
      owner: zOwner,
      repo: zRepo,
      run_id: zId.describe("ID of the workflow run"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/actions/runs/${params.run_id}/jobs`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 6. get_action_job_logs
  server.tool(
    "get_action_job_logs",
    "Get the plaintext logs of an Actions job",
    {
      owner: zOwner,
      repo: zRepo,
      job_id: zId.describe("ID of the workflow job"),
      attempt: z.number().int().positive().optional().describe("1-based attempt number; omit to fetch the latest attempt"),
    },
    async (params) => {
      try {
        const data = await client.getRaw(
          `/repos/${params.owner}/${params.repo}/actions/jobs/${params.job_id}/logs`,
          { attempt: params.attempt }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 7. list_action_run_artifacts
  server.tool(
    "list_action_run_artifacts",
    "List the artifacts of an Actions workflow run",
    {
      owner: zOwner,
      repo: zRepo,
      run_id: zId.describe("ID of the workflow run"),
      name: z.string().max(255).optional().describe("Filter by artifact name"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/actions/runs/${params.run_id}/artifacts`,
          {
            name: params.name,
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 8. list_action_artifacts
  server.tool(
    "list_action_artifacts",
    "List a repository's Actions artifacts",
    {
      owner: zOwner,
      repo: zRepo,
      name: z.string().max(255).optional().describe("Filter by artifact name"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/actions/artifacts`,
          {
            name: params.name,
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 9. get_action_artifact
  server.tool(
    "get_action_artifact",
    "Get the metadata of an Actions artifact",
    {
      owner: zOwner,
      repo: zRepo,
      artifact_id: zId.describe("ID of the artifact"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/actions/artifacts/${params.artifact_id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 10. delete_action_artifact
  server.tool(
    "delete_action_artifact",
    "Mark an Actions artifact for deletion",
    {
      owner: zOwner,
      repo: zRepo,
      artifact_id: zId.describe("ID of the artifact"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/repos/${params.owner}/${params.repo}/actions/artifacts/${params.artifact_id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 11. list_action_tasks
  server.tool(
    "list_action_tasks",
    "List a repository's Actions tasks",
    {
      owner: zOwner,
      repo: zRepo,
      status: z.array(zRunStatus).optional().describe("Only return tasks with these statuses"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/actions/tasks`,
          {
            status: params.status,
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 12. dispatch_workflow
  server.tool(
    "dispatch_workflow",
    "Trigger an Actions workflow run (workflow_dispatch event)",
    {
      owner: zOwner,
      repo: zRepo,
      workflowfilename: zName.describe("Workflow file name, e.g. build.yml"),
      ref: zRef.describe("Git reference to run the workflow on (branch, tag, or commit SHA)"),
      inputs: z.record(z.string()).optional().describe("Input keys and values configured in the workflow file"),
      return_run_info: z.boolean().optional().describe("Return information about the created run"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/actions/workflows/${params.workflowfilename}/dispatches`,
          {
            ref: params.ref,
            inputs: params.inputs,
            return_run_info: params.return_run_info,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Repository secrets ────────────────────────────────────────────────

  // 13. list_repo_action_secrets
  server.tool(
    "list_repo_action_secrets",
    "List the Actions secrets of a repository (names only, values are never returned)",
    {
      owner: zOwner,
      repo: zRepo,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/actions/secrets`,
          {
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 14. set_repo_action_secret
  server.tool(
    "set_repo_action_secret",
    "Create or update an Actions secret for a repository",
    {
      owner: zOwner,
      repo: zRepo,
      secretname: zSecretName.describe("Name of the secret"),
      data: zSecretData.describe("Secret value. Line endings are normalized to LF; Base64-encode the data if they must be retained"),
    },
    async (params) => {
      try {
        const data = await client.put(
          `/repos/${params.owner}/${params.repo}/actions/secrets/${params.secretname}`,
          { data: params.data }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 15. delete_repo_action_secret
  server.tool(
    "delete_repo_action_secret",
    "Delete an Actions secret of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      secretname: zSecretName.describe("Name of the secret"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/repos/${params.owner}/${params.repo}/actions/secrets/${params.secretname}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Repository variables ──────────────────────────────────────────────

  // 16. list_repo_action_variables
  server.tool(
    "list_repo_action_variables",
    "List the Actions variables of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/actions/variables`,
          {
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 17. get_repo_action_variable
  server.tool(
    "get_repo_action_variable",
    "Get an Actions variable of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      variablename: zSecretName.describe("Name of the variable"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/actions/variables/${params.variablename}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 18. create_repo_action_variable
  server.tool(
    "create_repo_action_variable",
    "Create an Actions variable for a repository",
    {
      owner: zOwner,
      repo: zRepo,
      variablename: zSecretName.describe("Name of the variable"),
      value: zBody.describe("Variable value. Line endings are normalized to LF"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/actions/variables/${params.variablename}`,
          { value: params.value }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 19. update_repo_action_variable
  server.tool(
    "update_repo_action_variable",
    "Update the value (and optionally the name) of an Actions variable of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      variablename: zSecretName.describe("Name of the variable"),
      value: zBody.describe("Variable value. Line endings are normalized to LF"),
      name: zSecretName.optional().describe("New name for the variable (converted to uppercase by Forgejo)"),
    },
    async (params) => {
      try {
        const data = await client.put(
          `/repos/${params.owner}/${params.repo}/actions/variables/${params.variablename}`,
          {
            value: params.value,
            name: params.name,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 20. delete_repo_action_variable
  server.tool(
    "delete_repo_action_variable",
    "Delete an Actions variable of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      variablename: zSecretName.describe("Name of the variable"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/repos/${params.owner}/${params.repo}/actions/variables/${params.variablename}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Repository runners ────────────────────────────────────────────────

  // 21. list_repo_runners
  server.tool(
    "list_repo_runners",
    "List the Actions runners of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      visible: z.boolean().optional().describe("Include all runners visible to this scope (true) or only those directly owned by it (false)"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/actions/runners`,
          {
            visible: params.visible,
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 22. get_repo_runner
  server.tool(
    "get_repo_runner",
    "Get an Actions runner of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      runner_id: zId.describe("ID of the runner"),
    },
    async (params) => {
      try {
        const data = await client.get(`/repos/${params.owner}/${params.repo}/actions/runners/${params.runner_id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 23. register_repo_runner
  server.tool(
    "register_repo_runner",
    "Register a new Actions runner for a repository. The response contains the runner token, which is only shown once",
    {
      owner: zOwner,
      repo: zRepo,
      name: zTitle.describe("Name of the runner (does not have to be unique)"),
      description: zBody.optional().describe("Description of the runner"),
      ephemeral: z.boolean().optional().describe("Register as an ephemeral runner"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/repos/${params.owner}/${params.repo}/actions/runners`,
          {
            name: params.name,
            description: params.description,
            ephemeral: params.ephemeral,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 24. delete_repo_runner
  server.tool(
    "delete_repo_runner",
    "Delete an Actions runner of a repository",
    {
      owner: zOwner,
      repo: zRepo,
      runner_id: zId.describe("ID of the runner"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/repos/${params.owner}/${params.repo}/actions/runners/${params.runner_id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 25. list_repo_runner_jobs
  server.tool(
    "list_repo_runner_jobs",
    "Search the Actions run jobs of a repository that are waiting for a runner, optionally filtered by labels",
    {
      owner: zOwner,
      repo: zRepo,
      labels: z.string().max(1024).optional().describe("Comma-separated list of run job labels to search for"),
    },
    async (params) => {
      try {
        const data = await client.get(
          `/repos/${params.owner}/${params.repo}/actions/runners/jobs`,
          { labels: params.labels }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Organization secrets ──────────────────────────────────────────────

  // 26. list_org_action_secrets
  server.tool(
    "list_org_action_secrets",
    "List the Actions secrets of an organization (names only, values are never returned)",
    {
      org: zOwner.describe("Organization name"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/orgs/${params.org}/actions/secrets`,
          {
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 27. set_org_action_secret
  server.tool(
    "set_org_action_secret",
    "Create or update an Actions secret for an organization",
    {
      org: zOwner.describe("Organization name"),
      secretname: zSecretName.describe("Name of the secret"),
      data: zSecretData.describe("Secret value. Line endings are normalized to LF; Base64-encode the data if they must be retained"),
    },
    async (params) => {
      try {
        const data = await client.put(
          `/orgs/${params.org}/actions/secrets/${params.secretname}`,
          { data: params.data }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 28. delete_org_action_secret
  server.tool(
    "delete_org_action_secret",
    "Delete an Actions secret of an organization",
    {
      org: zOwner.describe("Organization name"),
      secretname: zSecretName.describe("Name of the secret"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/orgs/${params.org}/actions/secrets/${params.secretname}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Organization variables ────────────────────────────────────────────

  // 29. list_org_action_variables
  server.tool(
    "list_org_action_variables",
    "List the Actions variables of an organization",
    {
      org: zOwner.describe("Organization name"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/orgs/${params.org}/actions/variables`,
          {
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 30. get_org_action_variable
  server.tool(
    "get_org_action_variable",
    "Get an Actions variable of an organization",
    {
      org: zOwner.describe("Organization name"),
      variablename: zSecretName.describe("Name of the variable"),
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/actions/variables/${params.variablename}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 31. create_org_action_variable
  server.tool(
    "create_org_action_variable",
    "Create an Actions variable for an organization",
    {
      org: zOwner.describe("Organization name"),
      variablename: zSecretName.describe("Name of the variable"),
      value: zBody.describe("Variable value. Line endings are normalized to LF"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/orgs/${params.org}/actions/variables/${params.variablename}`,
          { value: params.value }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 32. update_org_action_variable
  server.tool(
    "update_org_action_variable",
    "Update the value (and optionally the name) of an Actions variable of an organization",
    {
      org: zOwner.describe("Organization name"),
      variablename: zSecretName.describe("Name of the variable"),
      value: zBody.describe("Variable value. Line endings are normalized to LF"),
      name: zSecretName.optional().describe("New name for the variable (converted to uppercase by Forgejo)"),
    },
    async (params) => {
      try {
        const data = await client.put(
          `/orgs/${params.org}/actions/variables/${params.variablename}`,
          {
            value: params.value,
            name: params.name,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 33. delete_org_action_variable
  server.tool(
    "delete_org_action_variable",
    "Delete an Actions variable of an organization",
    {
      org: zOwner.describe("Organization name"),
      variablename: zSecretName.describe("Name of the variable"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/orgs/${params.org}/actions/variables/${params.variablename}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Organization runners ──────────────────────────────────────────────

  // 34. list_org_runners
  server.tool(
    "list_org_runners",
    "List the Actions runners of an organization",
    {
      org: zOwner.describe("Organization name"),
      visible: z.boolean().optional().describe("Include all runners visible to this scope (true) or only those directly owned by it (false)"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          `/orgs/${params.org}/actions/runners`,
          {
            visible: params.visible,
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 35. get_org_runner
  server.tool(
    "get_org_runner",
    "Get an Actions runner of an organization",
    {
      org: zOwner.describe("Organization name"),
      runner_id: zId.describe("ID of the runner"),
    },
    async (params) => {
      try {
        const data = await client.get(`/orgs/${params.org}/actions/runners/${params.runner_id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 36. register_org_runner
  server.tool(
    "register_org_runner",
    "Register a new Actions runner for an organization. The response contains the runner token, which is only shown once",
    {
      org: zOwner.describe("Organization name"),
      name: zTitle.describe("Name of the runner (does not have to be unique)"),
      description: zBody.optional().describe("Description of the runner"),
      ephemeral: z.boolean().optional().describe("Register as an ephemeral runner"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/orgs/${params.org}/actions/runners`,
          {
            name: params.name,
            description: params.description,
            ephemeral: params.ephemeral,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 37. delete_org_runner
  server.tool(
    "delete_org_runner",
    "Delete an Actions runner of an organization",
    {
      org: zOwner.describe("Organization name"),
      runner_id: zId.describe("ID of the runner"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/orgs/${params.org}/actions/runners/${params.runner_id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 38. list_org_runner_jobs
  server.tool(
    "list_org_runner_jobs",
    "Search the Actions run jobs of an organization that are waiting for a runner, optionally filtered by labels",
    {
      org: zOwner.describe("Organization name"),
      labels: z.string().max(1024).optional().describe("Comma-separated list of run job labels to search for"),
    },
    async (params) => {
      try {
        const data = await client.get(
          `/orgs/${params.org}/actions/runners/jobs`,
          { labels: params.labels }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── User secrets ──────────────────────────────────────────────────────

  // 39. set_my_action_secret
  server.tool(
    "set_my_action_secret",
    "Create or update an Actions secret for the authenticated user",
    {
      secretname: zSecretName.describe("Name of the secret"),
      data: zSecretData.describe("Secret value. Line endings are normalized to LF; Base64-encode the data if they must be retained"),
    },
    async (params) => {
      try {
        const data = await client.put(
          `/user/actions/secrets/${params.secretname}`,
          { data: params.data }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 40. delete_my_action_secret
  server.tool(
    "delete_my_action_secret",
    "Delete an Actions secret of the authenticated user",
    {
      secretname: zSecretName.describe("Name of the secret"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/user/actions/secrets/${params.secretname}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── User variables ────────────────────────────────────────────────────

  // 41. list_my_action_variables
  server.tool(
    "list_my_action_variables",
    "List the Actions variables of the authenticated user",
    {
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          "/user/actions/variables",
          {
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 42. get_my_action_variable
  server.tool(
    "get_my_action_variable",
    "Get an Actions variable of the authenticated user",
    {
      variablename: zSecretName.describe("Name of the variable"),
    },
    async (params) => {
      try {
        const data = await client.get(`/user/actions/variables/${params.variablename}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 43. create_my_action_variable
  server.tool(
    "create_my_action_variable",
    "Create an Actions variable for the authenticated user",
    {
      variablename: zSecretName.describe("Name of the variable"),
      value: zBody.describe("Variable value. Line endings are normalized to LF"),
    },
    async (params) => {
      try {
        const data = await client.post(
          `/user/actions/variables/${params.variablename}`,
          { value: params.value }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 44. update_my_action_variable
  server.tool(
    "update_my_action_variable",
    "Update the value (and optionally the name) of an Actions variable of the authenticated user",
    {
      variablename: zSecretName.describe("Name of the variable"),
      value: zBody.describe("Variable value. Line endings are normalized to LF"),
      name: zSecretName.optional().describe("New name for the variable (converted to uppercase by Forgejo)"),
    },
    async (params) => {
      try {
        const data = await client.put(
          `/user/actions/variables/${params.variablename}`,
          {
            value: params.value,
            name: params.name,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 45. delete_my_action_variable
  server.tool(
    "delete_my_action_variable",
    "Delete an Actions variable of the authenticated user",
    {
      variablename: zSecretName.describe("Name of the variable"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/user/actions/variables/${params.variablename}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── User runners ──────────────────────────────────────────────────────

  // 46. list_my_runners
  server.tool(
    "list_my_runners",
    "List the Actions runners of the authenticated user",
    {
      visible: z.boolean().optional().describe("Include all runners visible to this scope (true) or only those directly owned by it (false)"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          "/user/actions/runners",
          {
            visible: params.visible,
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 47. get_my_runner
  server.tool(
    "get_my_runner",
    "Get an Actions runner of the authenticated user",
    {
      runner_id: zId.describe("ID of the runner"),
    },
    async (params) => {
      try {
        const data = await client.get(`/user/actions/runners/${params.runner_id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 48. register_my_runner
  server.tool(
    "register_my_runner",
    "Register a new Actions runner for the authenticated user. The response contains the runner token, which is only shown once",
    {
      name: zTitle.describe("Name of the runner (does not have to be unique)"),
      description: zBody.optional().describe("Description of the runner"),
      ephemeral: z.boolean().optional().describe("Register as an ephemeral runner"),
    },
    async (params) => {
      try {
        const data = await client.post(
          "/user/actions/runners",
          {
            name: params.name,
            description: params.description,
            ephemeral: params.ephemeral,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 49. delete_my_runner
  server.tool(
    "delete_my_runner",
    "Delete an Actions runner of the authenticated user",
    {
      runner_id: zId.describe("ID of the runner"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/user/actions/runners/${params.runner_id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 50. list_my_runner_jobs
  server.tool(
    "list_my_runner_jobs",
    "Search the Actions run jobs of the authenticated user that are waiting for a runner, optionally filtered by labels",
    {
      labels: z.string().max(1024).optional().describe("Comma-separated list of run job labels to search for"),
    },
    async (params) => {
      try {
        const data = await client.get(
          "/user/actions/runners/jobs",
          { labels: params.labels }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── Instance runners (admin) ──────────────────────────────────────────

  // 51. admin_list_runners
  server.tool(
    "admin_list_runners",
    "List the Actions runners of the instance (requires admin privileges)",
    {
      visible: z.boolean().optional().describe("Include all runners visible to this scope (true) or only those directly owned by it (false)"),
      page: zPage,
      limit: zLimit,
    },
    async (params) => {
      try {
        const data = await client.get(
          "/admin/actions/runners",
          {
            visible: params.visible,
            page: params.page,
            limit: params.limit,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 52. admin_get_runner
  server.tool(
    "admin_get_runner",
    "Get an Actions runner of the instance (requires admin privileges)",
    {
      runner_id: zId.describe("ID of the runner"),
    },
    async (params) => {
      try {
        const data = await client.get(`/admin/actions/runners/${params.runner_id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 53. admin_register_runner
  server.tool(
    "admin_register_runner",
    "Register a new Actions runner for the instance (requires admin privileges). The response contains the runner token, which is only shown once",
    {
      name: zTitle.describe("Name of the runner (does not have to be unique)"),
      description: zBody.optional().describe("Description of the runner"),
      ephemeral: z.boolean().optional().describe("Register as an ephemeral runner"),
    },
    async (params) => {
      try {
        const data = await client.post(
          "/admin/actions/runners",
          {
            name: params.name,
            description: params.description,
            ephemeral: params.ephemeral,
          }
        );
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // 54. admin_delete_runner
  server.tool(
    "admin_delete_runner",
    "Delete an Actions runner of the instance (requires admin privileges)",
    {
      runner_id: zId.describe("ID of the runner"),
    },
    async (params) => {
      try {
        const data = await client.delete(`/admin/actions/runners/${params.runner_id}`);
        return formatResponse(data);
      } catch (err) {
        return formatError(err);
      }
    }
  );
}
