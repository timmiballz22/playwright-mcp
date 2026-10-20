# Execution ledger

Updated 2026-10-20. Baseline `804bc7e`. Branch `feat/local-production-hardening`.
**NOT RELEASE-READY.** Status labels below describe whole gates, not isolated tests.
Latest completed native matrix: `741f31ebaffeee750e2e4dd3338659e4f807db9c`,
535 passed, one Windows raw Firefox pointer-action timeout; zero test skips or
cancellations. All component/guardian jobs and original wrapper jobs passed.
Last complete green remains `d71c91eb47815ff1945375cb735dc203cbb8daa7` (469).
A supported sequential pointer-input candidate needs native validation. Public
job tools/queue/controller remain unfinished. All 45 mandatory scenarios are
mapped in [SCENARIO_MATRIX.md](SCENARIO_MATRIX.md).

| Gate | Status | Evidence / source | NEXT ACTION |
|---|---|---|---|
| G00 BASELINE | IN PROGRESS | BASELINE_AUDIT.md; original managed-Chromium baseline 8/8 and six unchanged schemas; default local Chrome still absent | Preserve channel/OS baseline limitations; extend original native baseline evidence |
| G01 INSTALL | IN PROGRESS | scripts/verify-package.mjs: production tarball, both stdio handshakes; SDK runtime, private fork identity | Finish minimum Node-version policy and automated current Node LTS matrix |
| G02 MCP | IN PROGRESS | local-batch/mcp.test.mjs real compact 1000-action call, EOF/SIGTERM and actual Codex operator evidence; production-smoke.mjs | Test concurrent calls, malformed protocol and full resource ownership |
| G03 FEATURE PARITY | IN PROGRESS | evidence/discovery-*.json: 25 default / 72 extended tools per configured browser; tests/capabilities.spec.ts | Add representative behavior tests for every capability group |
| G04 BATCH | VERIFIED PASS | local-batch/mcp.test.mjs + integration.test.mjs; evidence/codex-client-operator.txt: exact 1000 actions / 997 clicks | Extend real long workflow to other browsers |
| G05 RETRIES | IN PROGRESS | route.fetch maxRetries:0 avoids automatic replay; no 429/503 policy | Implement tested Retry-After handling without unsafe replay |
| G06 JOBS | IN PROGRESS | Native independent supervisor/admission/journal proof; internal guardian has local lifecycle/installed-browser evidence; public jobs absent | Native guardian proof, public IDs/queue/status/result/cancel/cleanup and real controller death/recovery |
| G07 SECURITY | FAILED | security.test.mjs reproduces/fixes redirect SSRF on Chromium/Firefox; unknown origins/fields denied | DNS rebinding, credential-canary screenshot safeguards, upload rules, all negative fixtures |
| G08 STORAGE | IN PROGRESS | runner.mjs mkdtemp private per-run artifacts; report.mjs exclusive report write | Atomic artifacts, quotas, retention and native Windows ACL evidence; 20-run uniqueness already passed |
| G09 AUTH/PROFILES | NOT STARTED | Batch ephemeral only; upstream retains profile features | Reuse upstream isolation/profile APIs with project locks and tests |
| G10 CROSS-BROWSER | IN PROGRESS | CI at 2321179: Chromium/Firefox/WebKit positive batch + redirect fixtures, original Chrome/Chromium/Firefox/WebKit behavior on Linux/macOS/Windows; evidence/ci-final-*.json | 9e73a08 supervised positives/admission passed; diagnose strict Windows raw Firefox cleanup with fixed stage codes; earlier intermittency remains recorded; local WebKit unavailable |
| G11 CROSS-OS | IN PROGRESS | Native CI green at 2321179; plain CLI + actual Codex operator smoke verified on Linux | Native bootstrap passed 53 tests per OS at 5264cb6; execute actual Codex operator setup on native Windows/macOS |
| G12 PERFORMANCE | IN PROGRESS | scripts/soak-local.mjs; PERFORMANCE.md; evidence/soak*.txt | Process-tree RSS/FD/CPU measurement, latency/token/CLI comparison |
| G13 ACCESSIBILITY/MOBILE | IN PROGRESS | Original MCP preserves role-based click; batch role/name, testId, label, placeholder and text selectors added | Keyboard, mobile/touch/media assertions and selector behavior/negative fixtures |
| G14 ADVANCED | IN PROGRESS | 72 contracts; native original storage/screenshot/trace/video/tabs/Chromium PDF behavior passed; tests/advanced.spec.ts | Frames/dialog/upload/network tools and remaining advanced positive/negative cases |
| G15 RELEASE SAFETY | VERIFIED PASS | distribution.test.mjs, private package, publish-disabled.cjs; no registry publishing workflow | Keep publication disabled; registry ownership and a future authorized release remain separate |
| G16 DOCUMENTATION | IN PROGRESS | LOCAL_BATCH.md, BASELINE_AUDIT.md, THREAT_MODEL.md, PERFORMANCE.md | Finish examples/feature docs as jobs/profiles mature; operator walkthroughs on all OSs |
| G17 AUDIT EVIDENCE | IN PROGRESS | This ledger + evidence logs + test scripts | Keep tested SHA/CI evidence current; complete all 45 scenarios |
| G18 CLEAN MERGE | IN PROGRESS | Fork branch, pinned dependencies retained; lint and diff checks | Retain green configured CI; resolve critical gaps and inspect protection before merge |

## Defects and risk register

- RISK-001/002: runtime SDK promoted, lock regenerated, source/tarball checks implemented.
- RISK-003: inherited publish operations removed; private fork package/registry identities.
- RISK-004: implicit loopback removed; exact local policy. Newly reproduced P0:
  route.continue follows redirects without re-interception. Fixed using route.fetch
  maxRedirects:0/maxRetries:0; **all redirects currently rejected**, including approved
  same-origin. WebSockets closed, service workers blocked. DNS/OS egress still residual.
- RISK-005: launch included in deadline; late launch closed; cleanup bounded at 5s/resource.
  Supervised CLI/MCP process termination and report deadline added; native candidate evidence pending. Raw runner remains cooperative.
- RISK-006: per-run directories prevent screenshot overwrite; retention/redaction open.
- RISK-007: errors remain sanitized, diagnostic taxonomy incomplete.
- RISK-008: durable jobs/queues/reconnect are NOT implemented.
- RISK-009: Chromium/Firefox verified selectively; WebKit libraries unavailable locally.
- RISK-010: blocked requests produce policy_blocked, not false workflow success.
- RISK-011: unknown fields rejected, actions copied before async execution to prevent
  mutation-after-validation URL bypass (test reproduced before fix). Schema v1 and 1 MiB bound added; deeper AST/assertion semantics pending.
- RISK-012: read-only workflow permissions, concurrency cancellation, timeouts and OS
  browser matrix added; actual green runs still required.
- RISK-013: route.fetch/fulfill changes network semantics/cache; benchmarks incomplete.
- RISK-014: docs remove implicit-localhost/runtime-SDK claims; unsupported features explicit.
- Dependency audit initially found 3 advisories (1 low, 2 moderate); compatible npm audit
  fix updated transitive lock entries. Recheck recorded in evidence.

## Executed commands

Baseline: npm ci; npm run lint; npm test -- --workers=2;
node --test local-batch/*.test.mjs (5 pass / 1 fail / 1 skip before browser install).
Browser install: npx playwright install chromium firefox webkit (downloaded);
--with-deps failed su authentication; sudo unavailable.

Regression commands and exact captured output live in docs/evidence:
- npm test -- --project=chromium --project=firefox --workers=2
- RUN_BROWSER_TESTS=1 node --test local-batch/runner.test.mjs local-batch/distribution.test.mjs local-batch/integration.test.mjs local-batch/mcp.test.mjs
- node --test --test-name-pattern='chromium|firefox' local-batch/security.test.mjs
- node --test local-batch/security.test.mjs (includes WebKit environment failure; not green)
- node scripts/discover-tools.mjs (schema discovery does not launch browsers)
- node scripts/verify-package.mjs (fresh production tarball install + both handshakes)
- node scripts/soak-local.mjs; node --expose-gc scripts/soak-local.mjs
- npm audit --omit=dev; npm run lint; git diff --check

## Blockers and continuation

Native WebKit missing libgtk-4, libgraphene, libharfbuzz-icu, libmanette,
libhyphen, libGLESv2; cannot install with local su authentication. Branch protection
API 403. These do not excuse unimplemented jobs/schema/security tests.

NEXT ACTION: inspect CI; fix actual failures, then implement isolated worker job
execution to enforce full lifecycle/process termination and durable status before
adding wider workflow actions. Keep all gates incomplete until independently proved.

## Milestone 2 — ongoing

- Screenshot capture now disabled unless operator option allowSensitiveArtifacts
  is true, CLI --allow-sensitive-artifacts or MCP environment
  PLAYWRIGHT_BATCH_ALLOW_SENSITIVE_ARTIFACTS=1. Workflow/page cannot enable it.
- 20 real screenshots across paired concurrent Chromium runs passed uniqueness
  and POSIX 0700 directory checks (artifacts.test.mjs). Retention still absent.
- Actual EOF and SIGTERM during a hanging real browser navigation each failed
  before fix (>10s no exit). SDK stdio transport does not handle stdin EOF itself.
  Explicit EOF/signal server close + active abort fixed both: 2/2 passed under 1s.
  Process-tree enumeration/forced-kill proof still outstanding.
- Schema v1 (unversioned legacy treated as v1), 1 MiB serialized input cap, strict
  role/name/testId/label/placeholder/text selectors, deep selector snapshot added.
- CI first milestone: Linux/macOS wrapper and batch jobs succeeded when inspected;
  Windows/Docker still running. No full green claim yet.
- Removed redundant feat-branch push trigger: PR plus main push only; cancelled
  duplicate push run 39474710658 deliberately (NOT a functional failure).

Milestone 2 final local regression: 22 tests, 21 passed, 1 FAILED (WebKit could
not launch: missing native libraries), 0 skipped/cancelled; see
evidence/batch-milestone2.txt. Newly added HTTP fixture tests 401/403/404/429/500/503
classification with one request each, seeded header/body canaries absent from
results, and Retry-After metadata. No automatic retry/backoff scheduler yet.

First CI run URLs:
- https://github.com/timmiballz22/playwright-mcp/actions/runs/39474746024
  Linux/macOS batch passed; Windows failed before tests because PowerShell
  passed *.test.mjs literally to Node 20. Replaced wildcard invocation with
  scripts/test-batch.mjs using explicit file enumeration (also bootstraps).
- https://github.com/timmiballz22/playwright-mcp/actions/runs/39474746316
  Linux/macOS wrapper and Docker passed when inspected; final status pending.
- 39474710658 was intentionally cancelled as a duplicate push run, not a test failure.

Native Linux/macOS CI on the first commit executed the real WebKit redirect
fixture successfully; local WebKit remains unavailable. This is selective coverage,
not complete G10 behavior acceptance. Draft PR: https://github.com/timmiballz22/playwright-mcp/pull/2.

## Milestone 3 — current work

Code milestone 2 SHA: `32477dd9cdf62a3664ac9427149cec39b9b0a603`.
Native CI on that SHA: Linux/macOS batch 22/22 passed; Windows 21/22 passed,
with an invalid POSIX-only exit-code expectation for abrupt Windows SIGTERM.
Fixed test to require signal SIGTERM/code null on Windows; EOF still requires
exit zero on all systems. This proves bounded server exit, not process-tree cleanup.

Wrapper matrix on same SHA: Linux/macOS/Docker passed; Windows 35/36 passed.
Chrome cold startup took ~24s; first click exceeded default 5s stable-element
wait. Added explicit Windows Chrome test budget: action 15s/test 60s, and one Windows CI browser worker to avoid competing
cold branded Chrome launches. Linux/macOS retain two CI workers. Production
defaults unchanged; cold Windows Chrome reliability remains an investigation item
until fresh CI and repeated evidence. No automatic action retries added.

- Original storage/cookies, screenshot PNG bytes, trace file existence, video WebM
  bytes, tab management and Chromium PDF bytes now tested in tests/advanced.spec.ts.
  Local Chromium/Firefox: 2 passed; native WebKit/Windows evidence pending.
- Compact explicit per-action repeat is bounded before expansion; expanded total
  remains <=1000. One real MCP tool call now executes 1000 operations using four
  declared steps (997 clicks). Both counter fixtures now use exact text equality
  rather than substring matching. This does not implement conditional control flow.
- Batch positive navigation/click/assert/screenshot fixtures added for Firefox and
  WebKit (20 clicks each); Chromium remains 1000 total operations.
- Local WebKit workaround: extracted official Debian trixie packages into /tmp,
  checked downloaded .deb SHA256 against HTTPS Packages index. Loader experiments
  did not produce stable browser execution; temporary cache symlinks removed and
  only experiment-owned processes terminated. Not a PASS; use native CI libraries.

Milestone 3 local acceptance: `node scripts/test-batch.mjs`: 26 tests,
24 passed, 2 failed (both actual WebKit launch environment failures),
0 skipped/cancelled. `npm test -- --project=chromium --project=firefox --workers=2`:
20 passed, 0 failed/skipped. Fresh production tarball verifies both handshakes.
See evidence/{batch-third-final,upstream-third-final,production-third-final}.txt.

## Milestone 4 — client test isolation

Milestone 3 implementation SHA: `735ee47f9f70ca7f31997e54cb0a91b0a18ea1aa`.
Additional regression found in tests/fixtures.ts: optional mcpArgs array was
mutated by startClient, leaking the first client's storage capability into the
next client. Reproduced via real two-client discovery before fix; cloned base
arguments before appending per-client flags. tests/capabilities.spec.ts regression
now passes; full local Chromium/Firefox wrapper run: 22 passed, 0 failed/skipped.

Node 22 subset: npx --yes --package=node@22 node --test
local-batch/runner.test.mjs local-batch/distribution.test.mjs local-batch/mcp.test.mjs
— 16 passed, 0 failed/skipped/cancelled, including compact exact-counter real
1,000-operation MCP call. See evidence/node22.txt. Native CI uses Node 20 and
current results must be checked at the next commit; queued is not pass.

Remaining security concern identified in review: route.fetch buffers response
bodies; network-response byte quotas and browser process-tree memory caps are not
implemented. Treat this as an additional resource-exhaustion release blocker.

NEXT ACTION: inspect newest CI Windows/macOS/Linux results, diagnose failures;
then build isolated worker jobs with durable metadata and full process/report
deadlines. All remaining G00–G18 criteria still apply.

## Final tested milestone (mission incomplete)

Tested code commit: `2321179bf52f79abe7986c8d6a2b133c46f1da5a`.
- https://github.com/timmiballz22/playwright-mcp/actions/runs/39478123877
  All three native OS batch jobs: 26 passed each, 0 failed/skipped/cancelled.
- https://github.com/timmiballz22/playwright-mcp/actions/runs/39478123906
  All three native OS wrapper jobs: 44 passed each; Docker: 2 passed; lint green.
  Eight configured CI jobs across both workflows succeeded, 212 executed tests total,
  0 failures/skips/cancellations in these final runs. Earlier superseded runs
  remain cancelled or failed as recorded; they are not relabeled.
- Native Node 20 CI; local Node 24.19.0; Node 22.23.3 subset 16/16 passed.
- Separate baseline 804bc7e worktree: all 8 original tests passed with an explicit
  managed-Chromium config (default branded Chrome still unavailable locally).
  All six complete discovery schema records match the original exactly.
- Actual Codex CLI 0.163.0 app-server: original + batch endpoints discovered;
  real upstream navigation; one batch call, four declared steps, 1,000 operations
  with exact counter, 33.882s; zero model turns. Temporary per-process configuration
  and ephemeral thread; global Codex config unchanged. See operator evidence.
- Plain CLI operator fixture: 26 operations, accessible label/role selectors,
  empty fill/check/uncheck, exact count, report write and seeded input canary
  absence from stdout/stderr/report. Local HTTP only, no connected model/client.
- G15 evidence also includes expected npm-publish refusal and package.private;
  no registry publish operation remains in inherited workflow.
- Final evidence/hygiene follow-up adds `.playwright-mcp/` to gitignore after the
  real client generated an upstream snapshot there. `git check-ignore` confirms
  exclusion. This changes no runtime source or test behavior. Its commit uses
  [skip ci] to avoid rerunning an identical matrix; CI PASS applies to 2321179,
  not to an unexecuted/skipped run.

Still NOT RELEASE-READY: all remaining G00–G18 criteria apply. G04/G10/G15 have
the evidence above; other gates are partial or failed. NEXT ACTION remains isolated
worker ownership/process/report deadlines, DNS/egress and byte/memory quotas;
then durable jobs/queues, profiles/recovery and remaining acceptance work. No package publication or main merge.

## Supervised execution candidate (native CI pending)

This candidate replaces CLI/MCP in-process execution with an independent watchdog
and execution worker. Public BrowserServer process ownership enables scoped
termination without exposing its private loopback endpoint. Deadlines cover setup,
actions, report publication and worker exit; cancellation, worker/supervisor crashes,
CPU stalls, stalled reporting and abrupt frontend death have fault fixtures.
Temporary browser directories are private and removed after termination. Atomic
report publication prevents partial JSON after injected ENOSPC; completed actions
are preserved as a lower bound and never automatically replayed. MCP blocks new
work after uncertain cleanup. Direct raw runner calls retain cooperative semantics.

Evidence under `docs/evidence/worker-*`:
- Latest targeted lifecycle acceptance: 9 passed, 0 failed/skipped/cancelled.
- Complete local batch suite: 38 tests, 35 passed, 3 failed, no skips/cancellations.
  All three failures are WebKit setup due to missing host libraries in this
  container; these are failures, not passes or evidence of native compatibility.
- Node 22 subset: 9 passed (executor, report fault and MCP 1,000 operations).
- Independently installed production package in a path containing spaces:
  both endpoints completed real browser calls; original discovered 25 tools,
  companion one. Lint and diff whitespace checks pass.
- Preserved failing-before fixtures prove the report partial-write and startup
  cancellation race before their fixes. New native Windows/macOS/Linux CI is
  required before assigning compatibility evidence to this runtime candidate.

Remaining boundaries: CLI file loading/parsing is outside the supervised budget;
256 MiB is worker V8 heap, not total RSS; route.fetch buffers allowed responses;
DNS/OS egress and disk/response quotas remain open. Process termination is not an
OS sandbox and cannot promise recovery from kernel stalls or simultaneous host
controller loss. Atomic rename is not a fsync-backed durable job journal. No
queues, durable jobs or persistent companion profiles are implemented. G06/G07
and the full mission remain incomplete; old 212-test evidence applies to 2321179.
NEXT ACTION: native candidate CI, bounded CLI ingestion, then remaining egress,
resource, durable-state and acceptance requirements. No publish or main merge.

## Follow-up: bounded input and successful long-poll cleanup

CLI file ingestion now opens without POSIX FIFO blocking, checks the opened
handle is a regular file, reads at most 1 MiB plus one sentinel byte, rejects
oversize/growth and invalid UTF-8, and supports a UTF-8 BOM. It does not promise
bounded latency for a stalled filesystem; ingestion still precedes execution's
monotonic deadline. Tests cover exact-limit JSON, oversize, invalid encoding,
directory and POSIX FIFO inputs.

A real allowed long-poll fixture reproduced false `policy_blocked` on successful
context closure. Teardown now distinguishes transport errors after closing starts;
explicit origin and redirect denials still increment policy violations. Local
follow-up: routing and loader passed, Chromium/Firefox redirect protection passed,
WebKit redirect setup failed due to host libraries (4 passed, 1 failed). Real CLI
26-operation redaction/report fixture passed. Native CI for the preceding worker
commit remains pending; no new compatibility gate is claimed.

Follow-up verification: 10 targeted tests passed; two new tests passed on Node 22;
fresh installed-package real browser calls passed for both endpoints (58 files).

Actual Codex app-server recheck on supervised source: both endpoints discovered,
upstream navigation passed; one batch call completed 1,000 operations in 34.061s,
zero model turns. Temporary configuration only. See worker-codex-followup evidence.

Native CI at 37be5d0 completed: wrapper 44/44 on all three OSs, Docker 2/2,
lint passed. Batch Linux 38/38; macOS 37/38 (WebKit early action_failed instead
of timeout); Windows 35/38 (WebKit policy_blocked, and abrupt-host tests observed
locked browser files). These failures remain failures. Follow-up adds diagnostics
for the WebKit result, waits for independent supervisor cleanup after abrupt
Windows frontend exit, and prevents final test-directory removal from masking
an earlier assertion with EBUSY. Parent-death ownership assertions remain strict.
No Windows resource-cleanup PASS is claimed from these failed tests.

## Windows temporary-file cleanup follow-up (native verification pending)

CI at fa45d3b: batch Linux 40/40, macOS 40/40; Windows 37/40, with the three
failures preserved in worker-ci-second evidence. Wrapper all jobs passed again.
Windows now exposes the actual residual temporary directory rather than masking
it with final test teardown EBUSY. Tracked processes stopped, but cleanup left
files behind. WebKit diagnostics identify an early goto failure, not a timeout.

The new candidate moves temporary deletion into a bounded cleanup child with
retry handling for transient Windows file locks; supervisor waits for child exit.
A startup-deadline test proves an expired child cannot later remove the directory.
The browser deadline fixture now explicitly serves text/html, matching the working
integration fixture, instead of relying on MIME sniffing. This is not yet proof
of the Windows WebKit failure's cause. Two real Chromium negative fixtures prove
unapproved iframe and WebSocket destinations receive zero requests while workflow
policy denial and cleanup are observed. Local lifecycle/security subset: 13 passed;
cleanup subprocess test: 1 passed. Typed Chromium/Firefox deadline fixtures passed.
New candidate native CI is required; Windows cleanup is still an open gate until
it passes. Filesystem/kernel stalls remain subject to OS termination limitations.

## Cancellation cleanup budget correction (native CI pending)

CI at 87ddfe2: batch Linux and macOS 43/43 each; Windows 40/43. WebKit now
passes the real deadline fixture with explicit HTML content type. Windows EOF,
SIGTERM and abrupt-host cleanup still fail temporary-directory assertions. Wrapper
all native jobs, Docker and lint passed. These failed assertions are retained.

Inspection found frontend cancellation forced the supervisor after only 500 ms,
shorter than its process-termination plus filesystem-cleanup budgets. The new
candidate allows up to five seconds for cooperative cancellation (the global
workflow deadline remains authoritative), reserves more of the Windows deadline
for cleanup and grants Windows 750 ms cooperative stop time. Windows termination
handles known browser trees before their worker root. A tiny private cleanup
receipt contains only schemaVersion, ok and an allowlisted filesystem error code;
fixtures print it on failure to distinguish absent completion from deletion errors.
It is diagnostic metadata, not a job journal. Local lifecycle subset: 11 passed;
no new Windows PASS is claimed before native execution. JOBS_DESIGN.md records
future durable-state invariants; durable jobs remain unimplemented.

## Protocol closure and native bootstrap candidate

Malformed JSON input followed by a valid ping passes without echoing a seeded
canary. A new oversized-frame test failed before the change: the pinned SDK's
10 MiB buffer guard closed its transport, but paused open stdin kept the companion
alive. Transport closure now aborts active work and destroys stdin; owned worker
cleanup remains awaited through its process handles, without process.exit.
Afterward, five protocol/disconnect/parent-death tests passed, and both protocol
tests passed on Node 22. Fresh installed endpoints passed real browser calls.
The next native QA run will invoke the actual Bash/PowerShell bootstrap scripts,
including pinned installation and the complete batch suite, instead of merely
running an equivalent test command. Linux library provisioning remains a separate
CI prerequisite. This does not certify native Codex operator interaction.

## Windows watchdog survival defect identified

At 1336a4b, Linux and macOS batch jobs each ran 43/43 successfully; Windows ran
41/43, with abrupt SIGTERM/host-death temporary cleanup failures and no cleanup
receipt. EOF and all three real browser deadline fixtures passed. To obtain the
run archive while macOS was queued, cancellation was requested. macOS acquired a
runner during that request and actually completed 43/43; overall batch run is
CANCELLED, not green. Wrapper Linux/Windows/Docker/lint passed; macOS wrapper is
CANCELLED. All outcomes and the failed Windows assertions are preserved.

Root cause from Node 20's bundled libuv source: non-detached children enter a
kill-on-parent-close Windows job object. The watchdog used detached:false on
Windows, so frontend death killed it before it could clean files; larger cleanup
budgets alone could not fix that. Source excerpt and exact upstream SHA are in
worker-windows-libuv-ownership.txt. The new candidate makes only the supervisor
detached on every platform; workers and cleanup children remain attached to their
Windows supervisor. Local lifecycle/protocol subset: 12 passed. Native Windows
survival remains pending; no all-OS or release PASS is claimed.

The same candidate includes the independently reproduced oversized-stdin shutdown
fix and next CI runs actual bootstrap scripts, plus complete Linux Node 22/24
batch jobs alongside three native Node 20 jobs. This is validation expansion,
not existing evidence of an LTS or bootstrap PASS.

## Watchdog ownership verified; remaining native test timing failures

9041497 native results: all five wrapper jobs passed (44 tests per OS, Docker 2,
lint). Batch Ubuntu Node 20/22/24 each 45/45 through actual Bash bootstrap;
macOS 44/45 (Firefox launch did not report ownership before the 5s fixture's
cleanup reservation); Windows 44/45 (raw integration click hit its 5s action
timeout after 11 completed operations). Total executed across these runs:
357 passed, 2 failed, no test skips/cancellations; whole batch matrix FAILED.
No registry publication or main merge. Cold-host timing remains an unresolved
acceptance issue; it is not relabeled as a pass.

All three OSs now pass EOF/SIGTERM, abrupt execution-host death with owned PIDs
stopped and temporary directory removed, protocol oversize closure and worker
fault tests. This confirms the Windows detached-supervisor correction against
the previously failing resource assertions. Actual PowerShell/Bash bootstraps
installed and ran the suite, but their overall results retain those two failures.

Next candidate serializes test files on macOS/Windows to remove competing fault
workers/browser loads; Linux retains concurrency two. The real deadline fixture
uses an explicit 10s total budget with 30s locator timeout, verifies launch and
owned termination, and retains a 15s observed ceiling. Production policy is not
modified by these test settings. No test retries are introduced. Static test
names and allowlisted cleanup receipts become immediate CI annotations so failures
can be diagnosed while another OS job queues.

New original-endpoint fixtures: prompts and no-dialog rejection; approved file
upload, missing/outside-workspace paths and symlink/junction escape rejection;
iframe targets and stale-frame references after navigation. Local Chromium and
Firefox: four tests passed. The first stale-frame fixture had an accidental
double-slash URL; failed-before log is preserved and canonical URL construction
fixed it. Native Chrome/WebKit/Windows junction coverage remains pending.

Actual Codex app-server on 9041497: original navigation plus one compact batch,
1,000 operations in 33.906s, zero model turns. See worker-codex-9041497.txt.
SCENARIO_MATRIX.md now maps all 45 mandatory scenarios without claiming missing
jobs/profiles/quotas/mobile/network guarantees. NEXT ACTION: verify the scheduling
candidate, then durable job ownership/state and outstanding security/resource work.

Scheduling-candidate launcher verification: complete local 45-test run, 42 passed,
3 failed (all WebKit missing-host-library setup), zero skips/cancellations. The
launcher preserves failure exit status and complete UTF-8 output. Separate real
Chromium/Firefox ten-second deadline fixtures: 2 passed. Original interaction
fixtures: 4 passed, including symlink escape and stale frame negative cases.

## Native Firefox hang diagnosis and whole-tree audits

f30d933: wrapper all jobs green, 52 tests per native OS plus Docker 2; batch four
jobs passed 45/45 each, Windows passed 44/45. Total 382 passed, 1 failed, no test
skips/cancellations. Mac deadline now passes. Windows raw Firefox still fails
mid-click despite serialized files: completed six operations, then a 5s click
timeout and failed cooperative cleanup (15.162s total). Host contention alone is
not established as the cause. All owned EOF/SIGTERM/abrupt-host shutdown checks
and native symlink/junction/dialog/frame fixtures passed; full batch remains FAILED.

Next candidate keeps the failing raw sequence and adds a trusted source-only
onActionFailure hook to obtain the fixed local fixture's Playwright call log.
No callback or raw diagnostics are accepted through workflow JSON/MCP. Unit
secret-canary proof confirms default results still omit underlying exception text.
It also adds positive supervised 20-click/exact-counter/PNG/report fixtures for
all three engines, because the previous positive integration called the raw
runner. Read-only OS process audits inspect descendants beyond the three tracked
root PIDs (POSIX process groups; Windows CIM PID/parent data only, no command lines).
These audits never terminate processes and will expose surviving descendants.

Local targeted proof: 14 unit tests, raw Firefox one, supervised positives two,
real deadlines two and abrupt-parent audit one passed (20 total). Local WebKit
host libraries remain unavailable. Windows CIM audit and the recurring raw
Firefox failure still require native execution. No retry, timeout increase for
the failing raw click, or successful release claim is introduced.

## Supervised positive and descendant audit results; safe failure retention

803cc88 native batch: Windows, macOS, Ubuntu Node 20 and Node 22 each 48/48;
Ubuntu Node 24 47/48. All wrapper jobs passed again. The single failure was new
supervised WebKit positive execution on Node 24: timeout at 19.065s with 12
confirmed operations, cleanup terminated and temporary directory removed. Total
397 passed, 1 failed, no test skips/cancellations. Windows raw Firefox did not
reproduce its prior failure; the cause is still OPEN, not declared fixed.
All new native process-tree audits and supervised positives on the other jobs
passed. Windows CIM audits collect PID/parent metadata only and never kill anything.

Next candidate serializes all batch files, including Linux, so deliberate CPU-stall
faults cannot compete with interactive browser fixtures. Windows raw Firefox runs
five fresh workflows sequentially; every iteration must pass before the next
starts, with distinct screenshot paths. No failed workflow is retried. Five such
raw Firefox workflows passed locally with an explicit test-only run-count setting.
The positive supervised fixture now checks temporary files and OS descendants
before asserting success, preserving cleanup proof even when execution fails.

A fixed failureKind code is sent before teardown and retained if reporting,
cleanup or the supervisor later stalls. Codes are selected from static enums;
raw error text, selector and input values do not cross this IPC path. A fault
fixture sends an extra fake-secret field and kills the supervisor after the
failure: confirmed progress and the safe failure survive, the secret is omitted,
and owned processes stop. Local unit/fault/report subset: 24 passed; fresh
installed endpoint browser calls and lint passed. See safe-failure evidence.

An uncommitted journal storage kernel is under local development in local-batch/jobs;
it is not packaged, exposed through MCP or part of this candidate's job claims.
Durable jobs remain unimplemented at the public endpoints. NEXT ACTION: native
verification and continued journal crash/ownership testing, then API integration.

## Independent cleanup authority fixes a false failure

033cbe3: four batch jobs 50/50 each; Windows 49/50. All wrapper jobs passed.
Total 407 passed, 1 failed, no test skips/cancellations. Windows five fresh raw
Firefox workflows passed without retries; its earlier intermittent action hang
is not declared explained. All serial Linux Node 20/22/24 jobs passed, including
the previously failing supervised WebKit positive. Full matrix remains FAILED.

The remaining Windows case completed all 23 Chromium actions, exact assertion
and PNG, then the worker reported cleanup_failed after a cooperative close.
The supervisor independently verified process termination and temp removal in
7.045s of the 20s budget, and the OS descendant audit passed. Propagating the
worker's earlier close failure despite that final proof produced a false failure.

The new supervisor reconciles cleanup-only outcomes only after clean worker exit,
owned termination, temp removal, a published worker report inside the owned run
and time remaining. Success additionally requires all actions confirmed, no failed
step and zero blocked requests. Action/policy failures remain failed; cancellation,
deadline, crash, report failure and uncertain cleanup cannot use this path.
execution.workerCleanupFailed preserves the original close failure. Worker reports
are explicitly reportScope=worker_execution and retain original evidence; the
supervisor reply is the final lifecycle outcome. This is verified recovery, not
an action retry or ignoring missing resources.

Three owned-child fault fixtures verify success, policy failure and action failure
through cleanup recovery; no live tracked processes remain. The existing real
ENOSPC report fault still fails correctly. Local combined unit/fault/report tests:
27 passed; targeted executor/report subset 12 passed; real Chromium/Firefox
supervised positives 2 passed; installed endpoints and lint passed. New native
verification is required before assigning a complete matrix PASS.

## Internal job journal component (native verification pending)

Added the isolated SQLite metadata kernel described in [JOBS_STORAGE.md](JOBS_STORAGE.md).
Nine local tests pass on Node 24 and nine on Node 22; installed production package
smoke passes for both browser endpoints and journal owner isolation/cancellation.
A dedicated native journal matrix now exercises Linux/macOS/Windows Node 22 and
Linux Node 24. No public job API or durable browser scheduler is implemented by
this change. G06 and the overall mission remain incomplete. Next: native evidence,
then guardian-owned job execution and public job tools without replay.

## Journal result value validation follow-up

A new negative test reproduced arbitrary string persistence through an otherwise
allowed result field. The journal now validates every persisted result value,
including nested execution and step fields, and excludes report/artifact paths.
A complete valid result round-trips; injected secret strings are rejected before
commit and remain absent from journal files. Nine local tests pass on Node 24
and Node 22. Evidence includes the failing-before and passing-after runs.

## Journal cancellation and deadline transition checks

Added a deterministic metadata-state test covering already expired requests,
cancel-before-activation, repeated terminal cancellation, active cancellation
intent and uncertain cleanup retaining the project lease. No browser starts in
this storage-only test. Ten local tests pass on Node 24 and ten on Node 22.
Native candidate 5264cb6 has passed all four journal jobs and all three Linux
batch jobs; macOS wrapper failed and remaining native jobs are still pending.
The failure is being investigated; the matrix is not green.

## Actual Codex client check at 97f3c57

Codex CLI 0.163.0 app-server discovered the original 25-tool endpoint and the
one-tool batch endpoint. Original navigation and one 1,000-action batch with
exact final assertions passed in 34.021s, zero model turns. Per-process config
only; global config unchanged. The first verification attempt used a malformed
temporary TOML override, exited before initialization and timed out in the old
harness. Correcting that override and detecting early child exit produced the
recorded pass. This was a harness correction, not an action retry. Evidence:
[worker-codex-97f3c57.txt](evidence/worker-codex-97f3c57.txt).

## Durable cancellation/deadline success fence

A failing-before state test demonstrated SUCCEEDED could commit after a durable
cancel intent. finish now rejects success when cancellation was requested or the
stored deadline has passed. The caller must finish the appropriate failure state
after cleanup; rejection does not silently release a lease. A trusted test-only
clock fixture advances time at the finish command, proving deadline rejection
without native scheduling sleeps. Eleven tests pass on Node 24 and Node 22; lint
and diff checks pass. This remains a storage component, not a public jobs API.

## Native candidate 5264cb6: 457 passed, one modal failure

[Batch/journal CI](https://github.com/timmiballz22/playwright-mcp/actions/runs/39508650097)
passed all nine jobs: 53 batch tests on Linux Node 20/22/24, macOS and Windows
(265 passes), plus 9 journal tests on three POSIX jobs and 8 on Windows (35 passes).
Windows supervised Chromium cleanup recovery passed, as did native resource audits.
[Wrapper CI](https://github.com/timmiballz22/playwright-mcp/actions/runs/39508650033)
passed Linux/Windows 52 each, macOS 51 with one failure, Docker 2 and lint. Total:
457 passed, 1 failed; zero test skips/cancellations. The overall matrix is FAILED.

macOS Chromium modal/upload exceeded its unchanged 30-second test budget and
then reported connection closed during teardown. The log lacks the stalled call;
this does not establish a product root cause or justify extending the budget.
The test now uses named static stages, bounded per-tool steps (30s navigation to
cover observed cold launch, 10s other calls), and no paths/input/raw stderr in
new failure diagnostics. Its total budget is unchanged. Native macOS additionally
requires three fresh complete Chromium modal workflows, all passing, no retries.
Local Chromium/Firefox modal+frame checks: 4 passed. Native validation is pending.

The individual-job log redirect was denied by this environment's network proxy.
The completed workflow archive was accessible and supplied the preserved evidence.
The durable result/cancellation/deadline hardening commits after 5264cb6 have only
local Node 22/24 evidence until the next native run. Public jobs remain unfinished.

## Trusted worker admission boundary (local verification)

Added source-only beforeWorkerStart to the supervised executor. The watchdog
withholds the worker start message until ownership admission resolves; rejection
returns journal_unavailable, pending admission cannot evade the existing deadline,
and a late resolution cannot start actions after cancellation/termination. No new
MCP/CLI inputs or job tools are exposed. Pre-ack failures preserve exact zero
actions. This is preparation for guardian-owned durable execution, not that full
integration. Default no-hook execution retains the direct start path.

Failing-before tests showed the missing hook allowed fixture effects. Afterward:
14 executor tests passed, one ENOSPC report-failure test passed, three admission
tests passed on Node 22, and gated real Chromium/Firefox positives passed (23
actions, exact counter, PNG and report per browser). Lint/diff checks passed.
Native hook/WebKit verification is pending; local WebKit remains unavailable.

## Journal key hard-link rejection

The managed-path negative test reproduced acceptance of an externally hard-linked
32-byte journal key. Keys now require one link after a bounded 200ms publication
window for a concurrent creator to remove its exclusive temporary name. Persistent
extra links fail unsafe_store before database creation; the outside key is untouched.
Eleven full journal tests pass on Node 24 and eleven on Node 22, including competing
initialization. The first negative-test draft left an unexpectedly accepted journal
open; its three owned test processes were explicitly stopped. The test now closes
any unexpectedly accepted client before asserting failure, so the preserved before
run terminates cleanly. Lint/diff checks pass; native verification is pending.

Additional legacy compatibility check for worker admission: Node 20 selected three
admission tests passed, eleven unmatched tests were reported skipped by that old
test runner. This targeted selection is not a full 14-test Node 20 run.

## Complete green native matrix at d71c91e

Exact tested commit: d71c91eb47815ff1945375cb735dc203cbb8daa7.
[Batch/journal](https://github.com/timmiballz22/playwright-mcp/actions/runs/39509693584):
nine jobs passed, 53 batch tests on Linux Node 20/22/24, macOS and Windows (265),
plus journal 11 on three POSIX jobs and 10 on Windows (43).
[Wrapper](https://github.com/timmiballz22/playwright-mcp/actions/runs/39509693524):
five jobs passed, 52 per native OS (156), three additional fresh macOS Chromium
modal workflows and Docker 2; lint passed. Total **469 passed, 0 failed, 0 test
skipped/cancelled**, all 14 jobs successful. No test retries were configured.

The previous macOS timeout did not recur; its product root cause remains unknown,
and this green run does not erase earlier intermittent failures. This commit
verifies journal result/value/state fences, not the later key hard-link fix or
worker admission hook. Those later commits require their own native matrix.
Their latest installed-package smoke passes both real browser endpoints and
journal owner isolation/cancel/result operations. Public durable execution,
profiles, quotas/retention, egress and remaining acceptance gates are unfinished.

## Internal durable execution bridge and cleanup-stage diagnostics

Added the trusted guardian described in JOBS_GUARDIAN.md. It verifies a canonical
workflow digest against the keyed journal record, activates its lease, commits
worker ownership before action admission, handles cancellation/IPC loss, and
persists only safe bounded results after cleanup. A guardian crash retains an
uncertain lease; no persisted PID authorizes a kill and no action resumes.
Six guardian + eleven journal + two snapshot tests pass locally (19) on Node
24 and Node 22. Fresh production tarball: both real browser endpoints plus a
real seven-action Chromium guardian workflow, durable result and owner isolation
pass. This remains an internal bridge: public jobs/queue/controller are absent.

A first disconnect test timed out waiting for ChildProcess close after IPC loss
although the guardian was already gone. The harness now observes exit and audits
descendants independently; failing-before and corrected logs are retained.
A fixed SQLite storage-full resource-write fault proves admission fails before
worker effects. Workflow fingerprints ignore object key order/defaults/repeat
expansion; source input mutation cannot change a captured workflow.

The raw runner now returns at most three fixed cleanup-stage codes (resource
context/browser/server, timeout/error). It continues to fail on cooperative
cleanup error; these diagnostics do not promote success. Two fault cases prove
private cleanup text is omitted and later browser close is still attempted.
Combined engine/executor/report regression: 32 passed. Native QA remains pending.

Native batch moves to Node 22 on all OSes for real installed guardian coverage,
retaining Linux Node 20/24. Original wrapper jobs remain Node 20 on all OSes and
Windows additionally runs the same strict five-fresh-run Firefox raw fixture,
so legacy cleanup failure coverage is retained. No added jobs or retries.

## Native 9e73a08: 483 passed, one strict raw Firefox cleanup failure

[Batch/journal](https://github.com/timmiballz22/playwright-mcp/actions/runs/39510797191):
Linux Node 20/22/24 and macOS each 56 passed; Windows 55 passed and one failed.
All four journal jobs passed (43 total). All trusted admission cases and gated
real browser positives passed on native OSes.
[Wrapper](https://github.com/timmiballz22/playwright-mcp/actions/runs/39510797200):
52 per native OS, three fresh macOS modal workflows, Docker 2 and lint passed
(161 tests). Total 483 passed, 1 failed, zero test skips/cancellations. FAILED
matrix; last complete green remains d71c91e (469).

The fourth fresh Windows raw Firefox run completed all 23 actions, exact counter
and PNG, then returned cleanup_failed in 9.533s. No action failed and no blocked
request was recorded. The prior raw click-timeout problem did not recur here;
these are distinct observed failures. The old raw result cannot identify which
close call timed out or threw. Fixed cleanup-stage codes now preserve that
distinction without raw error text, timeout inflation or relaxing success tests.
This is diagnostic progress, not a claimed cleanup fix. Public supervised lifecycle
cases passed; raw runWorkflow remains a trusted cooperative source API.

The internal guardian candidate retains opaque verified report IDs without storing
paths. A separate failing-before test showed oversized Retry-After values could
exceed journal metadata bounds; raw hints now must be safe integers in 0..24h,
otherwise the hint is omitted. HTTP errors still fail with no replay/backoff.
The latest local engine/executor/report subset is 33 passed, and guardian/storage
component is 19 passed on Node 24 and 19 on Node 22. Installed production package
passes real existing endpoints and seven-action Chromium durable execution with
report-ID lookup. Native guardian/controller acceptance is pending; no public
job tools, queue manager, profiles or release readiness are claimed.

## Guardian startup IPC-loss fence before native push

A trusted pre-disconnected-loader fixture reproduced a real startup race: the
old candidate missed the disconnect event during ESM loading, activated its lease
and ran the fake worker until TIMED_OUT. The guardian now explicitly checks
process.connected at startup and before processing a start packet, in addition
to its disconnect listener. The same fixture now becomes CANCELLED with exact
zero before activation; no worker effects start. All 20 component tests pass on
Node 24 and all 20 on Node 22 (zero failures/skips/cancellations). This remains
local fixture evidence; native and actual future controller SIGKILL proof remain.
The focused legacy Node 20 Firefox test also passes locally on Linux: one test,
five fresh complete workflows, no retries/skips. The Windows source cleanup
intermittency is not declared fixed.

## Native 9a7bc1d: 535 passed, first cold Windows process audit failed

[Batch/journal](https://github.com/timmiballz22/playwright-mcp/actions/runs/39514358223):
all five batch/bootstrap jobs passed 59 tests each (295). Installed Node 22
guardian execution, durable result/report lookup and owner isolation passed on
all three OSes, plus Linux Node 24. Three POSIX component jobs passed 20 each;
Windows component passed 18 of 19. Its guardian success case committed its result
but the first read-only PowerShell CIM process snapshot failed under the 5s
command guard (total case duration 6.362s). No complete audit was obtained for
that case, so it remains FAILED, not assumed clean. Other lifecycle cases passed.
[Wrapper](https://github.com/timmiballz22/playwright-mcp/actions/runs/39514358453):
52 per native OS, three fresh macOS modal cases, Docker 2, focused Windows Node
20 Firefox fixture (five fresh workflows) and lint all passed (162 tests).
Total 535 passed, 1 failed, zero test skips/cancellations; 13/14 jobs successful.
Raw Firefox cleanup failures did not recur on Windows Node 20 or 22; cause remains
open. Last complete green still d71c91e (469).

The test audit now requests only ProcessId/ParentProcessId and allows a bounded
10s Windows cold CIM startup. It classifies timeout/output-limit/exit/spawn errors
using fixed codes. It never substitutes an empty snapshot on error; all descendant
assertions remain required. Production execution/cancellation/cleanup deadlines
are unchanged. Native verification of this test-only change is required.

Actual Codex CLI 0.163.0 app-server at exact 9a7bc1d: original endpoint 25 tools,
batch endpoint one tool, original navigation and one 1,000-action batch passed
in 33.952s, zero model turns, temporary per-process config only. Public job tools
and queue/controller remain unfinished; this is not release readiness.

## Native 741f31e and Windows Firefox input mitigation candidate

[Batch/journal](https://github.com/timmiballz22/playwright-mcp/actions/runs/39516057228):
four batch jobs passed 59 each; Windows Node 22 passed 58/59. All four component
jobs passed (20 per POSIX job, 19 Windows), including the previously failed cold
Windows descendant snapshot.
[Wrapper](https://github.com/timmiballz22/playwright-mcp/actions/runs/39516057263):
all 162 tests and lint passed, including five fresh Windows Node 20 Firefox runs.
Total 535 passed, 1 failed, zero test skips/cancellations. Matrix remains FAILED.

Windows Node 22 raw Firefox fresh run #3 stopped at step 11, completed 10/23,
with zero blocked requests and cleanupFailures empty. The trusted call log shows
the locator resolved, visibility/enabled/stability checks passed, scrolling
finished, then timeout at 'performing click action' (5.010s). This is distinct
from the previous cooperative cleanup failure. No failure is reclassified success.

Read-only inspection of the pinned playwright-core coreBundle.js Mouse.click
(line 22639+) shows zero delay pipelines move/down/up with Promise.all; a positive
delay awaits each phase. Public Locator.click types document delay. The candidate
uses the supported delay=1ms only on Windows Firefox, retains all locator checks,
the same 5s default deadline and one click call, and introduces no force or replay.
This targets a plausible concurrent pointer-input issue; precise native cause
is not proved and real validation is mandatory. Node 20 and 22 Windows CI now
require ten fresh complete workflows each, all passing before the next begins.

Local policy/runner/cleanup subset: 21 passed; Node 22 policy subset: 3 passed.
Simulated host tests verify options, one locator invocation, failure counts, no
force/replay and no private error text. They do not emulate a Windows driver.
Unfinished pointer phases now use fixed pointer_action_timeout; this is a stage
classification, not proof of which internal acknowledgement stalled. A trusted
fixture-only failure hook can read its numeric counter once (500ms), without
replaying input. CLI/MCP hooks ignore the live Page and forward fixed metadata.
Public job tools/controller and remaining master gates remain unfinished.
