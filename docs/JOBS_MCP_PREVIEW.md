# Optional local jobs MCP preview

This stdio preview requires Node22.13+ and private local storage. POSIX uses
private modes; the experimental Windows configuration now uses protected
owner/System DACLs. Its helper passed native acceptance at ebdec88, while public
Windows installed public MCP/CLI and source1,000-action checks pass at6fffa27.
Actual Codex Windows discovery still fails; it is not release-ready.
The original MCP endpoint and one-tool batch endpoint remain available.

Register `playwright-jobs-mcp` (or `node local-batch/jobs-mcp.mjs`) with trusted
client environment values. No global client configuration is changed by installing
this package.

Generate a new owner UUID once for each registered client, then retain it across
reconnects: `node -e "console.log(require('node:crypto').randomUUID())"`.
Example UUIDs in setup snippets are placeholders, not shared registration IDs.

| Environment | Meaning |
| --- | --- |
| `PLAYWRIGHT_JOBS_OWNER_ID` | Required stable lowercase UUID identifying this registered local client. Keep it consistent across reconnects. |
| `PLAYWRIGHT_JOBS_PROJECT_DIR` | Existing project directory; defaults to the server working directory. Its canonical path defines the project namespace. |
| `PLAYWRIGHT_JOBS_DATA_DIR` | Optional private application state directory; defaults to `~/.local/state/playwright-batch/jobs`. |
| `PLAYWRIGHT_JOBS_ALLOWED_ORIGINS` | Comma-separated exact approved HTTP(S) origins, with no credentials, paths or query. Default empty. |
| `PLAYWRIGHT_JOBS_ALLOW_MUTATIONS` | `0` by default. Set `1` only for approved writes. |
| `PLAYWRIGHT_JOBS_ALLOW_SENSITIVE_ARTIFACTS` | `0` by default. Set `1` to permit screenshots. |
| `PLAYWRIGHT_JOBS_NAVIGATION_RETRIES` | Optional navigation retry count, 0–2. |

Configuration is operator-controlled, never tool input. New storage directories
are private; unsafe existing permissions, untrusted symlinks and writable
ancestors are rejected rather than repaired. Project journals are shared between
registered owners to enforce a single project execution lease. Owner UUIDs scope
records within the local service; they are not an authentication boundary against
other programs running as the same OS user.

The default policy permits navigation, assertions, waits, scrolling and separately
approved screenshots. It rejects declared mutation actions before admission and
blocks page requests using methods other than GET/HEAD before forwarding them.
Approved servers can still implement mutations on GET; this is not a semantic
write sandbox. DNS rebinding and OS-level egress restrictions remain unfinished.

| Tool | Behavior |
| --- | --- |
| `start_workflow` | Accepts `workflow` and a 1–128 character `requestKey`; returns a durable job ID quickly. Same owner/project/key and workflow returns the existing record without replay. Changed workflow conflicts. |
| `get_workflow_status` | Returns authorized state and confirmed progress for `jobId`. |
| `get_workflow_result` | Returns bounded result and readiness; optional `waitMs` is 0–10000. Canceling this lookup does not cancel the job. |
| `cancel_workflow` | Persists cancellation intent; cleanup precedes confirmed terminal completion. Repeated calls are safe. |
| `list_workflows` | Returns up to 20 recent authorized records. |
| `cleanup_workflows` | Previews artifacts for 1–10 unique `jobIds`; optional `dryRun: false` removes them. Only authorized terminal jobs with confirmed cleanup qualify. |

Workflow syntax matches [LOCAL_BATCH.md](LOCAL_BATCH.md). Owner, project,
origins, filesystem paths and permissions cannot be overridden by these tools.
Results expose an opaque report ID rather than report/artifact paths. A canceled
job that never started has zero completed actions and no execution result.

Closing the stdio connection cancels this controller's queued and active work.
There is no installed daemon, automatic replay or automatic resume. Reconnecting
with the same configuration reads persisted terminal records. Unknown cleanup
retains the project lease and requires operator attention.

Local acceptance covers an actual 1,000-action Chromium job, duplicate starts,
foreign-owner denial, cancellation, EOF cancellation and reconnect without replay.
Installed-package acceptance additionally exercises a real two-action job.
Native Linux/macOS six-tool cleanup/CLI and installed package checks passed at
ebdec88. Windows ACL helper positive/negative checks passed; public endpoint
integration is a new candidate, not certified Windows support. Retention, full
disk/browser quotas, managed profiles and other master-prompt gates remain open. Do not prune journal records to reuse keys.

Cleanup retains durable job records, request-key deduplication and safe result
summaries; it does not free history capacity or make an old key reusable. Opaque
report IDs in retained summaries do not guarantee a report file still exists.
Each execution tree is fully scanned before mutation: at most 2,048 entries,
eight directory levels and 512 MiB. Symlinks, hardlinked files, special files and
foreign-owned entries fail closed. These are cleanup bounds, not enforced write
quotas. Deletion uses individual unlink/rmdir operations, never recursive removal.

Cleanup returns per-job outcomes and can partially complete across jobs or after
an I/O error. Repeated calls safely continue or report an already absent scope.
Canceling a cleanup request stops between jobs; a current bounded filesystem scan
or deletion finishes first. It never kills processes, deletes journal records or
attempts cleanup of uncertain executions. Local configuration and files must not
be changed concurrently by another program running as the same OS user; this is
not a filesystem isolation boundary against that user.

## Foreground jobs CLI preview

`playwright-jobs` uses the same trusted environment, private journal and runtime/
platform restrictions. It writes newline-delimited JSON; errors use fixed codes
without echoing workflow inputs or private paths.

```sh
playwright-jobs start --workflow workflow.json --request-key my-stable-key
playwright-jobs status --job-id JOB_UUID
playwright-jobs result --job-id JOB_UUID --wait-ms 10000
playwright-jobs cancel --job-id JOB_UUID
playwright-jobs list --limit 20
playwright-jobs cleanup --job-id JOB_UUID
playwright-jobs cleanup --job-id JOB_UUID --delete
```

`start` first emits an accepted record, then remains in the foreground until its
terminal result. SIGINT/SIGTERM persist cancellation intent and wait for bounded
owned cleanup. Closing or killing it does not install or detach a background
service. Non-success terminal states return exit code 1. Other commands emit one
JSON record. Result waits are bounded to ten seconds; cancel persists intent but
does not itself wait for terminal state. Cleanup defaults to dry run; `--delete`
is explicit. Repeat `--job-id` for up to ten distinct cleanup targets. Request
keys are required for start; generate a new key only for intentionally new work.
Reusing a key still requires the workflow to pass the current operator policy.

Actual CodexCLI0.163.0 app-server acceptance is repeatable with
`node scripts/verify-codex-jobs.mjs /path/to/codex`. It discovers six tools and
checks a1,000-action job, duplicate keys, owner isolation, terminal artifact cleanup
and a separate active cancellation, with zero model turns and temporary config.
See [MCP_CLIENT_SETUP.md](MCP_CLIENT_SETUP.md) and codex-jobs-client evidence for
measured scope; this does not certify native conversational use.

## Screenshot byte budget

Approved screenshots have a default per-run total of16 MiB. Trusted operator
`PLAYWRIGHT_JOBS_MAX_SCREENSHOT_BYTES` accepts an integer from0 through268435456
(256 MiB). Workflow/tool arguments cannot change it. Sensitive-capture approval
is still separately required. Quota failure is `action_failed` with fixed
`failureKind: artifact_quota`; prior confirmed actions are retained without replay.

The worker obtains a viewport PNG buffer, checks the remaining byte budget before
image-file writes, and publishes private complete files through a temporary file
and atomic rename. Cancellation/deadline checks prevent late publication at the
checked boundaries. Run directories are private/unique and step indices ordered;
existing targets are rejected. No forced garbage collection or screenshot replay.

This bounds screenshot payload bytes, not browser memory, response bodies,
filesystem block overhead, reports, cleanup diagnostics, history or cumulative
project storage. Capturing the PNG buffer happens before checking its size. Full
write quotas, retention, OS resource controls and power-loss durability remain open.

Windows configuration requires local DOS-drive paths and Windows PowerShell5.1/
.NET Framework, invoked without profiles, elevation or execution-policy overrides.
Default storage is `%USERPROFILE%/AppData/Local/playwright-batch/jobs`; an explicit
`PLAYWRIGHT_JOBS_DATA_DIR` must pass the same ancestor and final-DACL checks.
UNC/device paths, reparse points and unsafe existing grants fail closed. Existing
ACLs are never repaired. Current SID plus canonical project determines the shared
journal namespace; owner UUID hashes separate artifact directories. The public
Windows installed MCP/CLI and source six-tool jobs pass at native6fffa27; actual
Codex Windows discovery remains unverified after an empty-inventory failure.

Native585acae passes Windows configuration/ACL components (39 checks in the
component job), but the first installed public MCP job returns terminal FAILED
before CLI coverage runs. Its cause is unproven because the old assertion omitted
the reason. Windows public execution is not certified; fixed diagnostics and
failure artifacts are being added. No ACL check is relaxed to address this.

The current setup fix moves only Windows ephemeral browser data into a unique
short private directory under the configured data base. Journal paths, artifact
paths, owner/project hashes and retained request keys remain stable. Local
lifecycle/fault checks pass; native installed/public acceptance is still pending.

Native6fffa27 supersedes the earlier public Windows setup failures above: combined
short browser temp plus exclusive UUID artifact allocation passes installed MCP/CLI
and source1,000-action verification. No ACL or cleanup assertion was relaxed.
Actual Codex Windows discovery still returns no tools; bounded readiness polling
and fixed startup-code diagnostics are a candidate, not a verified native fix.
