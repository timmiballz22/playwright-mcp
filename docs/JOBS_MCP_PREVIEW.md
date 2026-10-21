# Optional local jobs MCP preview

This stdio preview requires Node 22.13+ and POSIX private storage. Windows startup
fails closed until native ACL enforcement is implemented. It is not release-ready.
The original MCP endpoint and one-tool batch endpoint remain available.

Register `playwright-jobs-mcp` (or `node local-batch/jobs-mcp.mjs`) with trusted
client environment values. No global client configuration is changed by installing
this package.

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
Native acceptance for this new adapter is pending. Job CLI commands,
retention, full disk/browser quotas, profiles, Windows ACLs and the remaining
master-prompt gates are unfinished. Do not prune journal records to reuse keys.

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
