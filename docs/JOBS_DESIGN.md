# Durable job implementation contract

This is the execution integration contract, not an implemented public feature.
The internal bounded source controller is described in [JOBS_CONTROLLER.md](JOBS_CONTROLLER.md).
The internal metadata kernel is documented in [JOBS_STORAGE.md](JOBS_STORAGE.md),
and the trusted execution bridge in [JOBS_GUARDIAN.md](JOBS_GUARDIAN.md). The current
companion still exposes one synchronous batch tool. The supervised executor is
its execution boundary; the raw runner must not become a background job boundary.

A local stdio process owns a bounded queue and at most one active browser workflow
per operator-configured project. Returning a job ID keeps execution in that local
process; it does not install a daemon. EOF and shutdown cancel queued/running jobs.
Machine shutdown ends execution. Status persists; unsafe browser actions never
resume or replay automatically after restart.

Project and owner identity come from trusted local configuration and the OS user,
not tool arguments. Store private project metadata under the configured artifact
root. Canonicalize it before constructing the namespace. Generate a private local
owner key exclusively; never return it to the model. Validate every job ID before
constructing paths, reject symlinks in managed entries, and never kill a PID merely
because it occurs in a persisted file. PID reuse makes stale records insufficient
process ownership evidence.

Expose start, status, result, cancellation, bounded listing and finished-job cleanup.
Keep the existing synchronous API compatible. A start requires a bounded caller
request key. An exclusive durable request index maps that key to one job ID before
execution. Repeating the key with the same workflow returns that job; different
workflow input is rejected. Use a keyed workflow fingerprint, not persisted input
values or an unkeyed hash of potentially guessable secrets. Workflow inputs remain
in bounded memory. A crash can therefore lose queued input; recovery marks that
job CRASHED rather than pretending it can resume.

Persist schema version, project/owner IDs, job ID, state revision, safe timestamps,
confirmed completed count, stage, total, cancellation intent and bounded result
metadata. No URL, selector, form value, page text, cookie or raw browser exception
belongs in this journal. Sensitive artifacts retain the existing operator opt-in.
Publish records using exclusive temporary files, file fsync, atomic rename and
supported directory fsync; distinguish atomic visibility from power-loss durability
where the host filesystem cannot provide the latter.

Enforce CREATED -> VALIDATING -> QUEUED -> RUNNING -> SUCCEEDED / FAILED /
CANCELLED / TIMED_OUT / CRASHED. Failed validation becomes FAILED without executing.
Cancel before start becomes CANCELLED with exact zero. Running failures retain
confirmed lower-bound counts and retrySafe=false. Terminal records cannot return
to QUEUED or RUNNING. Persist cancellation intent before acknowledging it; active
cancellation must await owned-process cleanup before reporting a terminal state.
Uncertain cleanup blocks further project execution.

One exclusive project execution lease prevents competing sidecars from running
browsers simultaneously. A lease records a random instance identity plus PID;
readers must conservatively retain a lease when liveness cannot be disproved.
A stale lease can be reconciled only after the recorded owner is demonstrably
absent. Recovery marks nonterminal records CRASHED and never schedules them.
Competing recovery and lease acquisition must have an exclusive claim protocol;
no unchecked stale-file unlink or PID-based process killing is acceptable.

Bound pending queue length, journal size, result pagination, retained job count,
artifact bytes and cleanup work. A full queue rejects before launching a worker.
Finished cleanup operates only on verified owned job directories and never follows
symlinks or removes active/uncertain jobs. CPU, browser RSS, network response bytes
and OS egress remain separate controls; a queue limit is not a resource sandbox.

Acceptance must exercise duplicate starts across competing processes, lost start
responses, cancellation before dequeue/during launch/during actions, repeated cancel,
EOF, supervisor death, filesystem partial writes, stale leases, PID reuse ambiguity,
project separation, malicious IDs/symlinks, queue pressure and secret canaries.
Restart tests must prove no additional fixture-side effects. Public MCP schemas,
production tarballs and native OS tests must cover the resulting API before G06
can pass. No automatic retry/resume tool is enabled by this design.
