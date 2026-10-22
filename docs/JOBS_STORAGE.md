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

Host path handling for this inventory checks each supplied directory component
before canonicalization. Ordinary Windows short-name/case paths are accepted;
user symlinks/junctions are rejected. On macOS only the root-owned immutable
`/var`, `/tmp`, `/etc` aliases to their exact `/private` locations are accepted,
with `/private` ownership/write permissions checked. This avoids rejecting the
host's normal temporary directory without accepting caller-controlled links.
The scan and path checks remain inside the existing execution deadline.

An execution-worker exit without a browser ownership receipt is not proof of
an empty browser tree when its final receipt is absent or a browser launch was
attempted. A final failure report cannot certify that a rejected launch allocated
no child. The supervisor drains worker IPC before classifying natural exit and
marks these cases
`browser_ownership_unconfirmed`: cleanup fails, operator attention is retained and
new admission remains fenced even if a later read-only PID hint finds nothing.
This reports uncertainty; it does not claim to terminate an unreported child or
authorize killing a PID recovered from storage. Exact-key results still deduplicate.

## Local warm-open follow-up after native89

Reopening a validated v1 journal no longer assigns the same SQLite user_version.
That assignment appends a4,120-byte WAL frame even when the version is unchanged.
The conditional assignment stays inside the existing schema transaction; fresh
schema creation, project/key validation, FULL synchronous mode, busy timeout,
checkpoint configuration and two-second RPC budget remain unchanged. The normal
schema and metadata checks still run. This is not a fix claim for the native89
Windows progress timeout or its unresolved resources.

An actual Node22 baseline warm open grows WAL37,112→41,232 bytes. After the local
change, Node22/24 warm opens preserve exact37,112-byte WAL contents, with two
actual journal exits confirmed per observation. A real existing-job regression
preserves QUEUED state/revision and integrity; all38 journal/contention/controller
cases pass each Node22/24. Native effect is pending. Evidence:
native89-warm-journal-proof.json and native89-warm-journal-regression*.log.

The final WAL equality assertion reports only a boolean, so failure does not dump
store bytes. A controlled real SQLite repetition of the old header assignment
adds4,120 bytes and fails that regression; both actual journal workers confirm
exit and the failed store remains retained. The normal case then passes each
Node22/24. This negative is fixture-only, not a Windows-cause reproduction. See
native89-warm-write-negative-proof.json.

## Identity revalidation under the schema write lock

A separate SQLite connection can change the version/identity between the initial
read check and the schema write transaction. Controlled actual-connection probes
reproduce three incorrect accepts in source58edfce: future version2 reset to1,
version0 on an existing store reset to1, and deleted project identity recreated.

The same version/table/project/key verification now runs again under the existing
BEGIN IMMEDIATE lock, before schema writes. Future version, nonempty version0 and
missing marker are rejected; the other connection's change and existing job state/
revision remain untouched. All six probes across Node22/24 reject with the expected
code and confirmed rejected-worker exit;41 journal/contention/controller cases pass
each Node. No retry, deadline, SQLite setting, browser effect or host-sandbox claim.
Native91 and92 each pass all12 actual race cases across the four SQLite-capable
component lanes. This does not explain initialization latency or unconfirmed worker
exit in other receipts. See native90-schema-race-proof.json and the trusted
schema-version-race.mjs fixture, which is excluded from the production package.


## Installed journal smoke fixture preservation

Native92 exposes a separate QA bug: production-journal-smoke.mjs always removed
its own temporary journal directory and swallowed client-close rejections. Keeping
the outer installation workspace did not preserve this separate directory. The
local follow-up requires acceptance and all client closes before removal, retains
failed/rejected cases, and propagates close failures with the primary error. Its
bounded receipt records only a workspace basename, registered-client/close-failure
counts and failure/exit flags, with no journal/key contents. Actual-worker baseline
checks on Node22 reproduce deletion/error suppression; fixed negative and positive
cases on Node22/24 verify retention/removal behavior. Fresh production
installation checks pass locally. This is not a fix for the native92 Windows
rpc_timeout/init/directory/exit-unconfirmed receipt, whose exact blocked operation
and inner-directory post-state remain unknown. See native92 Windows package and
journal-fixture preservation proofs. No retry, signal authority, lease clearing,
SQLite setting or runtime deadline change.

A further local audit after native93 starts finds the same acceptance/cleanup
conflation in installed controller and parent-death smoke workspaces, plus ignored
SDK-close rejections in the profile smoke. Each now requires completed acceptance
and successful cleanup before removal; close failures retain the primary error.
Three actual-script baseline calibrations reproduce deletion after failed acceptance
and profile success after a controlled close error. Six fixed negative and six
healthy cases across Node22/24 verify retention/removal, using real controller,
SDK, journal and owned-browser paths. Fresh production install checks pass,
including both parent-death variants. Limits/signals/ownership algorithms unchanged;
native validation pending. See native93-smoke-fixture-preservation-proof.json and
native94-package-proof.json. Preservation is on the executing host: database/key
contents are not exported by these fixes, and an ephemeral CI runner is not a
permanent archive. Metadata receipts and raw logs are separate retained evidence.

The subsequent installed jobs-smoke audit finds primary-error loss on a cleanup
failure and an ignored final-close rejection. Both now propagate with the primary
cause, retain the workspace, and gate the Windows cleanup-confirmed marker until
all existing cleanup attempts succeed. Actual Node22 baseline reproduces both;
fixed combined/final-close/healthy cases on Node22/24 verify failure propagation,
retention/removal and scoped owned0. See native93-jobs-fixture-preservation-proof.json.

Parent-death initial process observations also emit before kill/assertions, with
full same-snapshot Windows legacy/rows through the existing read-only callback.
No role/name/age/window PID filter or ownership result changes. A64KiB bound fails
explicitly; stderr survives default execFileSync failures without changing stdout's
acceptance receipt. Linux actual positive, negative and linger-close forwarding is
verified; full Windows branch awaits native. See native93-parent-observation-proof.json.
