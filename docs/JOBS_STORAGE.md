# Internal durable journal storage

The SQLite journal in `local-batch/jobs/` stores bounded durable metadata.
The separate POSIX jobs MCP and foreground CLI now expose scheduling, status,
result, cancel, list and bounded terminal artifact cleanup; the synchronous
companion still exposes one batch tool. See [JOBS_MCP_PREVIEW.md](JOBS_MCP_PREVIEW.md)
and [JOBS_CONTROLLER.md](JOBS_CONTROLLER.md). These scoped endpoints do not make
the durable jobs gate complete: Windows private storage, full retention and
recovery operator flows remain unfinished.

The journal requires Node 22.13 or newer and runs SQLite in a bounded child process.
Node 20 synchronous execution remains available. Use a local filesystem; network
filesystem locking and power-loss durability have not been verified. WAL and FULL
synchronization support committed metadata; tests demonstrate process-crash
rollback, not a simulated storage-controller or power failure.

Fixed commands and SQL enforce owner isolation, request idempotency, bounded
queue/history, monotonic progress and one project execution lease. Raw workflows,
credentials and action error text are not stored. Request keys and workflow
fingerprints are keyed hashes. Responses omit private identity and lease tokens. Persisted results accept only
validated numeric/boolean/enum metadata and run UUIDs. Report paths and artifact
paths are excluded; the guardian/controller project those fields out before storing a result.
A timed-out journal RPC kills its owned child handle and never retries a mutation.
Only idempotent schema initialization has bounded busy retries.

The caller must validate workflows before creating metadata and prove resource
cleanup before releasing an active lease. Persisted PIDs are observations, never
kill authority. Dead queued controllers become CRASHED without replay; uncertain
active cleanup retains the project lease. This component alone cannot establish
browser execution ownership or successful browser cleanup.

Managed roots reject symlinks/junctions, persistent key/database hard links and
unrelated databases. Key publication allows at most 200ms for an exclusive
temporary publication link to disappear, then requires a single link.
POSIX directories/files use private modes; Windows ACL enforcement and evidence
remain open. A database marker and local key bind storage to the project before
schema writes. Corrupt or foreign stores are rejected without replacement.
The database has a 16 MiB page limit and bounded metadata, but this is not a full
browser, artifact, WAL or disk quota system.

Local verification: eleven tests pass on Node 24 and Node 22, including killed
pre-commit rollback, competing initialization, owner isolation, lease fencing,
secret metadata rejection, unchanged corrupt/foreign files, cancellation before
activation, uncertain cleanup blocking and rejected late success after durable
cancellation/deadline. Native Windows
runs omit the POSIX-only mode test. Installed-package smoke verifies both existing
browser endpoints plus journal creation, owner isolation and cancellation. Native
c7ae948 core journal/controller component suites passed on all three OSs; the new Windows ACL prototype has separate pending acceptance.

Live recovery now performs a read-only preflight. If no unstarted record expired
and all recorded holders/controllers remain live, it returns without a write lock.
Any possible recovery mutation re-reads and rechecks records under the original
BEGIN IMMEDIATE transaction. Durable writes, FULL synchronous mode,750ms lock wait
and2s RPC watchdog are unchanged. No command/action retry is added. A controlled
writer-lock fixture fails journal_busy before this change and reads successfully
afterward while the writer still holds the lock. Internal error diagnostics now
include only the fixed command verb, never its arguments. This reduces needless
poll contention; it is not proof that all native journal_busy causes are resolved.

The Windows private-storage helper (`private-windows.mjs`/`.ps1`) is an
**unwired prototype**. It uses Windows PowerShell/.NET Framework to create
protected owner/System DACLs at directory creation, rejects reparse points and
unsafe existing grants without repairing them, and namespaces by current SID
and canonical project. Native CI independently inspects ACLs and tests widened
ACL/junction rejection. Until that evidence and configuration integration pass,
public Windows startup continues to reject `unsupported_private_storage`.
