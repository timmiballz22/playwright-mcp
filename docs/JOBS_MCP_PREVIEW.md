# Optional local jobs MCP preview

This stdio preview requires flag-free SQLite (Node22.13+,23.4+,or24+) and private
local storage; maintained Node22/24 installations are recommended. POSIX uses
private modes; the experimental Windows configuration now uses protected
owner/System DACLs. Its helper passed native acceptance at ebdec88.
Windows installed public MCP/CLI and source1,000-action checks pass at6fffa27.
Native candidatefd17363 actual Codex Windows zero-turn jobs verification now
passes after replacing helper cmdlet serialization with standard .NET JSON.
Native8d661bf passes installed endpoints on all OSs and actual Codex1,000-action
checks on Linux/Windows; macOS actual Codex times out at888. Windows ownership
audits remain unresolved, including the separate Chromium functional soak after
its50-run receipt. The preview is not release-ready.
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
| `PLAYWRIGHT_JOBS_MAX_PAGES` | Observed open-page budget, default 8; operator integer 1–32. This is reactive, not an OS process/memory quota. |
| `PLAYWRIGHT_JOBS_MAX_SCREENSHOT_BYTES` | Per-run screenshot payload budget, default 16 MiB; operator integer 0–268435456. This does not bound total disk or browser memory. |

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
Codex Windows startup was later fixed atfd17363; zero-turn six-tool1,000-action
client verification passes. Full reliability/acceptance remains open.

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
The empty-inventory failure was later traced to ConvertTo-Json timing out under
Codex's filtered environment. Framework JSON serialization atfd17363 fixes native
startup and the actual zero-turn client check. Waiting alone was not a fix.

## Operator artifact retention

The jobs CLI can preview old terminal artifacts without adding an MCP tool or a
background service. Use the same trusted owner/project/storage environment as the
registered jobs client:

```sh
node local-batch/jobs-cli.mjs prune-artifacts --older-than-days 7 --limit 10
node local-batch/jobs-cli.mjs prune-artifacts --older-than-days 7 --limit 10 --delete
```

An age of 1–3650 whole 24-hour days is required. Preview is the default; `--delete`
authorizes removal for this invocation's policy. Each page selects at most ten
oldest eligible jobs for this owner/project. `hasMore` and `nextAfterJobId` support
continuation: append `--after-job-id` with that returned ID for the next page.
Keep the starting cursor when previewing and then deleting the same page.
Already-absent scopes remain in history and can be passed with the cursor.

The controller rechecks terminal state, known cleanup and age before opening each
execution scope. Active, newly fresh and uncertain jobs retain their files.
Each result reports its job ID and fixed counts/status, without paths, request
keys or file contents. A failed job outcome, interruption or known project cleanup
debt yields a nonzero exit; inspect those outcomes before continuing. Pagination
advances past attempted rows, so failed IDs can be retried explicitly through the
existing `cleanup --job-id` command. SIGINT/SIGTERM stops before the next job;
an already-started scope can complete.

Durable result summaries and idempotency keys stay in the journal. Artifact
pruning does not release an uncertain lease or reset profiles. It uses the same
per-scope entry/depth/byte bounds and link/ownership checks as explicit cleanup.
Scheduling, history purging and cumulative disk quotas remain separate work.

Artifact filesystem work now runs in an independent worker with a five-second
budget and up to one second to confirm forced exit. A valid receipt and natural
worker exit are both required for success. A timeout can leave partial deletion;
inspect the fixed error and preview before retrying. Unconfirmed exit reports
`cleanup_unconfirmed`, stops this retention page and blocks further cleanup/new
jobs in this controller. That diagnostic is not a durable maintenance lease;
parent-death containment and cross-controller uncertainty still need validation.
No changed browser/action/test deadline or OS disk quota is implied.
