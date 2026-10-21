# Internal durable journal storage

The SQLite journal in `local-batch/jobs/` stores bounded durable metadata.
The separate jobs MCP and foreground CLI now expose scheduling, status,
result, cancel, list and bounded terminal artifact cleanup (plus explicit age
pruning in the CLI); the synchronous
companion still exposes one batch tool. See [JOBS_MCP_PREVIEW.md](JOBS_MCP_PREVIEW.md)
and [JOBS_CONTROLLER.md](JOBS_CONTROLLER.md). These scoped endpoints do not make
the durable jobs gate complete: Windows public integration acceptance, full retention and
recovery operator flows remain unfinished.

The journal requires Node22.13+, Node23.4+ or Node24+ and runs SQLite in a bounded
child process; early Node23 is rejected.
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
POSIX directories/files use private modes; the Windows helper creates protected
owner/System DACLs at creation and rejects unsafe existing directories. A database marker and local key bind storage to the project before
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
c7ae948 core journal/controller component suites passed on all three OSs; the Windows ACL helper positive/negative tests pass natively at ebdec88, with public integration still pending.

Live recovery now performs a read-only preflight. If no unstarted record expired
and all recorded holders/controllers remain live, it returns without a write lock.
Any possible recovery mutation re-reads and rechecks records under the original
BEGIN IMMEDIATE transaction. Durable writes, FULL synchronous mode,750ms lock wait
and2s RPC watchdog are unchanged. No command/action retry is added. A controlled
writer-lock fixture fails journal_busy before this change and reads successfully
afterward while the writer still holds the lock. Internal error diagnostics now
include only the fixed command verb, never its arguments. This reduces needless
poll contention; it is not proof that all native journal_busy causes are resolved.

The Windows private-storage helper (`private-windows.mjs`/`.ps1`) is now wired
into experimental public job configuration after independent native ebdec88 tests
passed. It creates protected owner/System DACLs at directory creation, rejects
reparse points and unsafe existing grants without repairing them, and namespaces
by current SID plus canonical project. Public MCP/CLI configuration integration
and installed-package checks are newly enabled on Windows and await native
acceptance. Private-storage uncertainty still fails closed; local DOS drives only.
No administrator privileges, global ACL changes or execution-policy override.

Native585acae passes Windows configuration/ACL components (39 checks in the
component job), but the first installed public MCP job returns terminal FAILED
before CLI coverage runs. Its cause is unproven because the old assertion omitted
the reason. Windows public execution is not certified; fixed diagnostics and
failure artifacts are being added. No ACL check is relaxed to address this.

Controlled native40df6ca probe: short protected base65 characters succeeds with
two actions; full job artifact base214 characters fails setup, with confirmed
cleanup in both. The candidate keeps all existing journal/artifact paths and
idempotency keys, and instead puts Windows ephemeral browser data in an exclusive
`tmp-RUN_UUID` directory under the already protected base. No store migration or
ACL repair. Ownership ACK precedes browser allocation; only acknowledged scopes
are removed. A collision remains untouched, reports unknown cleanup and retains
uncertain execution fencing. Native public-job confirmation is pending.

The operator CLI `prune-artifacts --older-than-days N` previews bounded old
terminal artifact pages; `--delete` applies the selection, with age rechecked
before each scope. A read-only owner-bound `retention` journal RPC paginates by
stable terminal updated_at/id. The SQLite schema remains version1; no record,
event or idempotency key is deleted. See JOBS_MCP_PREVIEW.md for continuation,
interruption and limits. This is artifact retention control, not cumulative disk
quota or history compaction.

Terminal artifact cleanup also uses the existing singleton execution lease with a
fixed internal purpose marker and private nonce. Three fixed RPC commands reserve,
release after confirmed exit, or retain uncertainty. This adds no table/schema
migration: user_version remains1. Terminal job timestamps/events/results/request
keys stay stable; uncertainty changes only its dedicated flag. Admissions are
busy during a cleanup and blocked after unconfirmed termination. Older readers
still cannot reserve execution while the singleton lease is held. No process is
killed or lease released from persisted PIDs. A lost finalization acknowledgement
can conservatively strand the reservation; operator recovery remains unfinished.

Recovery additionally marks a maintenance reservation uncertain when its holder
is observed dead, retaining the lease and the original execution metadata. Live
or ambiguously reused holder PIDs keep the busy reservation; presence is never
authority to release it, and no persisted PID is killed. This improves diagnosis,
not automatic operator repair.

Journal worker termination is also bounded. Failed initialization waits at most
one second for the owned child handle to confirm exit; an unconfirmed worker is
not followed by another initialization attempt, including journal_busy. Close
keeps the existing two-second RPC watchdog, allows one second for graceful exit,
then requests owned-handle termination and allows one more second. No persisted
PID is signalled. Missing exit confirmation disconnects/unrefs the handle and
throws a fixed journalExitConfirmed:false diagnostic; it never claims shutdown.
The guardian forwards that diagnostic before IPC disconnect. Its controller
waits for both process exit and IPC drain before finalizing, and fences its local
queue on uncertainty even if prior terminal metadata says SUCCEEDED. This does
not add a durable cross-controller lease for a post-completion journal helper;
that residual limitation and manual recovery remain open. The jobs MCP shutdown
still closes its transport when controller close fails and emits fixed stderr
metadata only. Public tool schemas and action/RPC deadlines are unchanged.


The shared atomic report writer rejects serialized UTF-8 larger than8MiB before
creating output names. Source API error code is REPORT_BYTE_LIMIT; supervised
execution retains its existing execution_failed/report-stage envelope, completed
counts and retrySafe:false without replay. Exact-limit reports remain valid.
The limit includes pretty-print formatting/newline and does not establish total
project disk, browser memory or serialization-heap quotas.


Temporary-profile deletion also requires a valid fixed receipt and natural helper
close with IPC drained. Its existing operation deadline defaults to2s. After a
stop request it waits at most1s for exit confirmation through the owned child
handle, then disconnects/unrefs and returns false. False retains cleanup uncertainty
and never authorizes lease release or another workflow after unconfirmed cleanup.
A monotonic deadline check rejects a late success even if the timer callback was
delayed. No stored PID is signalled; malformed receipts and IPC errors fail closed.

Durable `JobController.open` execution now reserves retained artifact capacity before
browser launch. The default per-owner artifact directory limit is 512 MiB of
logical file bytes. Operators may set `PLAYWRIGHT_JOBS_MAX_RETAINED_ARTIFACT_BYTES`
in the jobs CLI/MCP environment, or trusted source callers may set `execution.maxRetainedArtifactBytes`
from 1 byte through 1 GiB; admission still requires enough capacity for the full
configured screenshot budget, an 8 MiB report and 16 KiB diagnostic allowance.
This setting is not a workflow/MCP argument. The scan rejects symlinks, hard-linked
files, foreign POSIX owners, special files, more than 10,000 entries or depth above
8. It runs inside the existing supervised worker deadline, before creating its run
workspace or launching a browser. A capacity/entry safety refusal returns `resource_limit` at workspace stage with zero completed actions; it does not prune files, replay the job or release an uncertain
cleanup fence. Explicit owner-authorized retention can make space for a new job.

The project execution lease serializes these checks with execution and cleanup.
The limit covers the standard private owner/project artifact directory. Trusted
source callers sharing one directory across unrelated project leases must supply
external serialization. Same-user external writers can race the scan; temporary
profiles/downloads, filesystem allocation, browser memory and journal bytes are
separate bounds. This is not a hard OS disk quota or automatic retention policy.
