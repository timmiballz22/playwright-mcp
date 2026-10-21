# Internal bounded job controller

`local-batch/jobs/controller.mjs` supplies a trusted source API over the journal
and detached guardian. It is not a public MCP/CLI jobs endpoint. The existing
batch tool remains synchronous. Node 22.13+ is required; no JSON-file fallback
silently substitutes for the SQLite journal.

`JobController.open({journal, execution, onEvent})` takes operator-owned source
configuration. `journal` contains directory, projectId and ownerId; `execution`
contains the existing supervised executor settings. The caller must establish
the canonical project namespace, local owner and private storage location.
These values cannot come from future model tool arguments or visited pages.
Windows ACL enforcement remains open in the storage kernel. Do not treat this
internal API as a completed authorization/configuration layer.

Methods:

- `start(workflow, requestKey)` validates and snapshots at most 1 MiB, commits an
  idempotent job record, and returns its bounded DTO. Matching duplicate keys
  return the same job without retaining/scheduling another input; payload changes
  fail with idempotency_conflict. Admission and queue time consume the workflow deadline.
- `status(id)`, `result(id)` and `list(limit)` read owner-scoped durable metadata.
  Listing is bounded to twenty. Reads reconcile expired unstarted/dead-controller
  records conservatively. Results are bounded journal summaries with opaque
  report IDs; no report/screenshot path is returned. An unstarted terminal job
  can have no stored result (result_expired); its status still records exact zero.
- `cancel(id)` persists cancellation intent. A queued, unreserved job becomes
  CANCELLED with exact zero. Running cancellation remains pending until guardian
  cleanup and canonical terminal publication. Repeated cancellation is idempotent.
- `close()` is idempotent, refuses new starts, cancels locally retained jobs and
  disconnects its active guardian. It waits for bounded journal operations and
  up to ten seconds for guardian exit/final bookkeeping. cleanupConfirmed=false
  is an uncertain outcome, never permission to delete files or release a lease.

There is at most one active guardian per controller and one execution lease per
project store. Independent controllers cannot execute simultaneously in that
project. Different project stores remain independent. Scheduling is FIFO within
one controller; cross-controller fairness is not implemented. No browser starts
until durable reservation/activation and worker admission complete.

At most eight source API requests are admitted into the serialized operation
chain. At most nine accepted workflows are retained (one active plus eight
queued), each at most 1 MiB encoded. JSON/string copies and engine memory add
runtime overhead; these are not browser RSS/CPU quotas. Journal create checks an
internal admitNew flag atomically *after* duplicate lookup, allowing existing keys
at capacity while refusing new retained input. requireCleanLease also checks
the project lease inside the same creation transaction, after duplicate lookup.
This blocks new admission when an already-open competing controller has not yet
observed another guardian's uncertain death; matching old keys remain readable. This also bounds memory when a
competing client cancels records whose payloads remain in the creator's memory.
Lifecycle finalization and close cannot be shed by request admission limits.

Inputs are never journaled. A process restart reconciles dead creators without
replaying lost queued input or browser actions. Library-object loss within a
still-running process is not a supported recovery boundary: retain the controller
until close; another object cannot prove that the old object has relinquished its
inputs. Unknown persistence outcomes block execution. No automatic mutation retry,
resume, or workflow replay is enabled.

A complete message alone does not admit another job: the controller waits for
its owned guardian's exit and canonical journal outcome. A guardian death before
activation permits exact-zero termination and preserves cancellation/deadline
intent. Death after activation uses conservative CRASHED recovery and retains the
uncertain lease, even if an independent audit later finds no live processes.
Persisted PIDs never authorize process killing. Trusted child handles/events are
the only process ownership source; closing the controller leaves forced cleanup
to the independent executor guardian/watchdog path.

Local tests exercise two successful queued jobs, duplicate keys/conflicts,
owner separation, queued/active cancellation, reconnect without replay, journal
and retained-input pressure, queued expiry, guardian death, close before dequeue,
and cancellation followed by guardian death before activation. Fault workers
create actual owned Node child processes; they are not browser coverage.
`scripts/production-controller-smoke.mjs` additionally runs two real Chromium
jobs (ten total actions) against source/fresh installed tarballs, checks duplicate
and reconnect behavior, and audits owned process exit. The installed parent-death
fixture now uses this controller before actual SIGKILL and lease/integrity checks.
Native ee54674 passed controller and preview checks on Linux/macOS; Windows
private storage remains unsupported and Firefox acceptance still fails. Persisted
queue timestamps use wall-clock time for display and conservative recovery. Live
controller submissions now also retain a monotonic deadline, expire unstarted
queued inputs and pass the original deadline to the guardian so a backward clock
change cannot extend execution. Forward clock changes can expire work early.
This newer deadline change awaits native acceptance; no restart/resume is added.

An optional POSIX start/status/result/cancel/list/cleanup MCP preview and trusted
configuration now wrap this controller; see [JOBS_MCP_PREVIEW.md](JOBS_MCP_PREVIEW.md).
The foreground jobs CLI also uses this controller. Retention, disk/browser quotas,
profiles and remaining security acceptance are unfinished. G06/G08 do not pass from this
component. The controller installs no daemon; machine shutdown stops execution.
