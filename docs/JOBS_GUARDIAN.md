# Internal durable execution guardian

`local-batch/jobs/guardian.mjs` connects the metadata journal to the supervised
executor. This is a trusted process protocol, not a public MCP job endpoint or
public queue manager. The internal [source controller](JOBS_CONTROLLER.md) now owns
bounded queued inputs; public start/status/result/cancel/list/cleanup tools and
operator configuration remain unfinished. G06 does not pass from this component.

The caller validates and snapshots a workflow, creates its idempotent journal
record, reserves the project lease and forks the guardian detached with ignored
stdio and IPC. Production smoke uses a 128 MiB guardian heap cap. The guardian
opens the same trusted project/owner identity and process incarnation, checks
the keyed workflow fingerprint, then activates the lease under its own PID.
A different payload cannot execute under a reserved job ID, even with the same
number of actions. Input stays in bounded memory and IPC, not the database.

Before the executor acknowledges worker start, the guardian commits the worker
PID through its trusted admission hook. Browser ownership and progress are then
recorded through serialized bounded journal RPCs. Cancellation intent is polled
and IPC loss aborts execution. The existing independent execution supervisor
owns forced termination and temporary cleanup. Persisted PIDs never authorize
kills. A guardian crash causes conservative CRASHED recovery and retains an
uncertain lease; browser actions never resume automatically.

After execution, the guardian waits for metadata writes and commits a bounded
result only after cleanup has returned. Report and screenshot paths are removed
from journal metadata. A verified report basename is retained as an opaque UUID,
so a future authorized result handler can derive its owned path without storing
operator paths. If cancellation/deadline wins between status read and
success commit, the rejected transition can be reclassified once; an unavailable
or ambiguous mutation is never retried. Uncertain cleanup retains the lease.
Unknown journal outcomes fail closed, even when browser cleanup may have worked.
The journal's Windows ACL, retention and full resource-quota limitations remain;
see [JOBS_STORAGE.md](JOBS_STORAGE.md).

Local Node 24 and Node 22: 20 component tests pass (seven guardian lifecycle cases,
eleven journal cases and two workflow identity/snapshot cases). These cover
success, cancellation, IPC disconnect, guardian crash, payload mismatch and a
fixed storage-full fault while persisting worker ownership, and IPC already
closed before guardian handlers load. The latter test first reproduced work
starting after the disconnect event had been missed; explicit connected-state
checks now cancel with exact zero before activation. The fault starts no
worker effects. Resource audits check live descendants independently. Tests use
owned Node child effects, not real browser claims. A fresh installed production
tarball additionally executes a real seven-action Chromium workflow through the
guardian and verifies its durable result and owner isolation.

The first IPC-disconnect test waited for ChildProcess close after IPC had been
explicitly disconnected; the guardian was already gone. Observing exit and then
separately auditing descendants corrected the harness. Actual controller SIGKILL through the internal source fixture now passes against
fresh installed production tarballs on Linux, macOS and Windows at 4855acb:
12/10/13 owned processes respectively, zero active descendants, CANCELLED,
released project lease and valid journal. Public job controller/tool schemas,
lost start responses and queue pressure remain acceptance work.

Native batch QA now uses Node 22 on all three OSes to exercise this Node 22.13+
component in installed-package browser smoke. Linux Node 20/24 coverage remains;
original wrapper CI still runs Node 20 on all OSes. A focused Windows Node 20
Firefox fixture preserves the legacy raw-runner cleanup regression after this
matrix change. The job count remains fourteen; no test retries were added.

Journal initialization failures can include a fixed `journalInitStage` diagnostic.
It identifies the last received worker phase within the unchanged RPC deadline;
it does not identify a proven blocked operation, reset a watchdog, acknowledge
a database write, or authorize lease release or process cleanup. The worker
sends no paths, SQL, credentials or user metadata in these phase messages.
