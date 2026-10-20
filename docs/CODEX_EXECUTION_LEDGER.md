# Execution ledger

Updated 2026-10-20. Baseline `804bc7e`. Branch `feat/local-production-hardening`.
**NOT RELEASE-READY.** Status labels below describe whole gates, not isolated tests.
Last complete native matrix: `2321179bf52f79abe7986c8d6a2b133c46f1da5a`,
212 passed with zero failed/skipped/cancelled. New supervisor candidate `37be5d0`
has local evidence below and native CI in progress; ingestion/routing follow-up
adds runtime changes. Do not apply the old complete matrix to newer code.

| Gate | Status | Evidence / source | NEXT ACTION |
|---|---|---|---|
| G00 BASELINE | IN PROGRESS | BASELINE_AUDIT.md; original managed-Chromium baseline 8/8 and six unchanged schemas; default local Chrome still absent | Preserve channel/OS baseline limitations; extend original native baseline evidence |
| G01 INSTALL | IN PROGRESS | scripts/verify-package.mjs: production tarball, both stdio handshakes; SDK runtime, private fork identity | Finish minimum Node-version policy and automated current Node LTS matrix |
| G02 MCP | IN PROGRESS | local-batch/mcp.test.mjs real compact 1000-action call, EOF/SIGTERM and actual Codex operator evidence; production-smoke.mjs | Test concurrent calls, malformed protocol and full resource ownership |
| G03 FEATURE PARITY | IN PROGRESS | evidence/discovery-*.json: 25 default / 72 extended tools per configured browser; tests/capabilities.spec.ts | Add representative behavior tests for every capability group |
| G04 BATCH | VERIFIED PASS | local-batch/mcp.test.mjs + integration.test.mjs; evidence/codex-client-operator.txt: exact 1000 actions / 997 clicks | Extend real long workflow to other browsers |
| G05 RETRIES | IN PROGRESS | route.fetch maxRetries:0 avoids automatic replay; no 429/503 policy | Implement tested Retry-After handling without unsafe replay |
| G06 JOBS | IN PROGRESS | executor fault tests, independent worker/supervisor and real parent-death cleanup; native candidate CI pending | Durable IDs/queue/journal; native ownership proof and recovery |
| G07 SECURITY | FAILED | security.test.mjs reproduces/fixes redirect SSRF on Chromium/Firefox; unknown origins/fields denied | DNS rebinding, credential-canary screenshot safeguards, upload rules, all negative fixtures |
| G08 STORAGE | IN PROGRESS | runner.mjs mkdtemp private per-run artifacts; report.mjs exclusive report write | Atomic artifacts, quotas, retention and native Windows ACL evidence; 20-run uniqueness already passed |
| G09 AUTH/PROFILES | NOT STARTED | Batch ephemeral only; upstream retains profile features | Reuse upstream isolation/profile APIs with project locks and tests |
| G10 CROSS-BROWSER | VERIFIED PASS | CI at 2321179: Chromium/Firefox/WebKit positive batch + redirect fixtures, original Chrome/Chromium/Firefox/WebKit behavior on Linux/macOS/Windows; evidence/ci-final-*.json | Keep wider interaction coverage tracked in G13/G14; local container WebKit remains blocked |
| G11 CROSS-OS | IN PROGRESS | Native CI green at 2321179; plain CLI + actual Codex operator smoke verified on Linux | Execute bootstrap scripts and batch CLI/Codex operator setup on native Windows/macOS |
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
