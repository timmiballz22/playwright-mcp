# Internal durable journal storage

The SQLite journal in `local-batch/jobs/` is an internal metadata component.
It does not expose job tools, schedule workflows, or make the durable jobs gate
complete. The synchronous companion still exposes one batch tool. Guardian-owned
execution integration, public status/cancel/result tools, retention and recovery
operator flows remain unfinished; see [JOBS_DESIGN.md](JOBS_DESIGN.md).

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
paths are excluded; future execution integration must project those fields out
before storing a result.
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
CI results for this component are pending.
