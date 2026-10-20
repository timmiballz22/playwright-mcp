# Execution ledger

Updated 2026-10-20. Baseline `804bc7e`. Branch `feat/local-production-hardening`.
**NOT RELEASE-READY.** Status labels below describe whole gates, not isolated tests.
First tested implementation SHA: `a5a5a13` (use `git rev-parse a5a5a13` for full SHA).
Second milestone in progress: sensitive-artifact policy, schema v1, accessible
selectors, actual EOF/SIGTERM shutdown, concurrent screenshot fixtures.

| Gate | Status | Evidence / source | NEXT ACTION |
|---|---|---|---|
| G00 BASELINE | FAILED | BASELINE_AUDIT.md; evidence/baseline-upstream.txt: 6 pass / 2 missing-Chrome failures | Run native full matrix; establish prechange full baseline where possible |
| G01 INSTALL | IN PROGRESS | scripts/verify-package.mjs: production tarball, both stdio handshakes; SDK runtime, private fork identity | Obtain native OS / Node LTS matrix |
| G02 MCP | IN PROGRESS | local-batch/mcp.test.mjs handshake, discovery, real 100-click call; production-smoke.mjs | Test active disconnect, signals, concurrent calls and resource ownership |
| G03 FEATURE PARITY | IN PROGRESS | evidence/discovery-*.json: 25 default / 72 extended tools per configured browser; tests/capabilities.spec.ts | Add representative behavior tests for every capability group |
| G04 BATCH | VERIFIED PASS | local-batch/integration.test.mjs; evidence/thousand.txt: 1,000 real Chromium operations, 997 clicks, exact completion and counter assertion | Extend real long workflow to other browsers |
| G05 RETRIES | NOT STARTED | route.fetch maxRetries:0 avoids automatic replay; no 429/503 policy | Implement tested Retry-After handling without unsafe replay |
| G06 JOBS | IN PROGRESS | runner.test.mjs stalled launch deadline + late close; runner.mjs bounded cleanup | Worker isolation, durable IDs/queue/journal; process-tree kill; reporting deadline |
| G07 SECURITY | FAILED | security.test.mjs reproduces/fixes redirect SSRF on Chromium/Firefox; unknown origins/fields denied | DNS rebinding, credential-canary screenshot safeguards, upload rules, all negative fixtures |
| G08 STORAGE | IN PROGRESS | runner.mjs mkdtemp private per-run artifacts; report.mjs exclusive report write | Atomic artifacts, quotas, retention, retention quota test (20-run concurrent screenshot test now passed) |
| G09 AUTH/PROFILES | NOT STARTED | Batch ephemeral only; upstream retains profile features | Reuse upstream isolation/profile APIs with project locks and tests |
| G10 CROSS-BROWSER | BLOCKED | Chromium/Firefox browser security + wrapper tests pass; WebKit actual launch fails missing libraries | Install native dependencies through CI (local su unavailable) |
| G11 CROSS-OS | IN PROGRESS | .github/workflows/{ci,local-batch}.yml native OS matrix configured | Inspect actual Windows/macOS/Linux results; queued != passed |
| G12 PERFORMANCE | IN PROGRESS | scripts/soak-local.mjs; PERFORMANCE.md; evidence/soak*.txt | Process-tree RSS/FD/CPU measurement, latency/token/CLI comparison |
| G13 ACCESSIBILITY/MOBILE | NOT STARTED | Original MCP preserves role-based click; batch role/name, testId, label, placeholder and text selectors added | Versioned selector AST, accessible assertions, touch/media fixtures |
| G14 ADVANCED | NOT STARTED | 72 discovery contracts only; behavior not proved | Tabs/frames/dialog/upload/storage/tracing/video/PDF real tests |
| G15 RELEASE SAFETY | IN PROGRESS | distribution.test.mjs, private package, publish-disabled.cjs; no registry publishing workflow | Release/evidence CI gate contract tests; registry ownership intentionally not asserted |
| G16 DOCUMENTATION | IN PROGRESS | LOCAL_BATCH.md, BASELINE_AUDIT.md, THREAT_MODEL.md, PERFORMANCE.md | Complete schema/client/architecture/release docs against implemented behavior |
| G17 AUDIT EVIDENCE | IN PROGRESS | This ledger + evidence logs + test scripts | Link tested SHA and CI results; complete all 45 scenarios |
| G18 CLEAN MERGE | IN PROGRESS | Fork branch, pinned dependencies retained; lint and diff checks | Green required CI, review all unresolved critical items; do not merge as READY |

## Defects and risk register

- RISK-001/002: runtime SDK promoted, lock regenerated, source/tarball checks implemented.
- RISK-003: inherited publish operations removed; private fork package/registry identities.
- RISK-004: implicit loopback removed; exact local policy. Newly reproduced P0:
  route.continue follows redirects without re-interception. Fixed using route.fetch
  maxRedirects:0/maxRetries:0; **all redirects currently rejected**, including approved
  same-origin. WebSockets closed, service workers blocked. DNS/OS egress still residual.
- RISK-005: launch included in deadline; late launch closed; cleanup bounded at 5s/resource.
  Process-tree force-kill and report I/O deadline remain open.
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
