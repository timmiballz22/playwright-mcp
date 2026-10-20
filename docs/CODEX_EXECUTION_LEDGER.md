# Execution ledger

Updated 2026-10-20. Baseline `804bc7e`. Branch `feat/local-production-hardening`.
**NOT RELEASE-READY.** Status labels below describe whole gates, not isolated tests.
Tested implementation SHA will be recorded after committing this milestone.

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
| G08 STORAGE | IN PROGRESS | runner.mjs mkdtemp private per-run artifacts; report.mjs exclusive report write | Atomic artifacts, quotas, retention, 20-run concurrent screenshot test |
| G09 AUTH/PROFILES | NOT STARTED | Batch ephemeral only; upstream retains profile features | Reuse upstream isolation/profile APIs with project locks and tests |
| G10 CROSS-BROWSER | BLOCKED | Chromium/Firefox browser security + wrapper tests pass; WebKit actual launch fails missing libraries | Install native dependencies through CI (local su unavailable) |
| G11 CROSS-OS | IN PROGRESS | .github/workflows/{ci,local-batch}.yml native OS matrix configured | Inspect actual Windows/macOS/Linux results; queued != passed |
| G12 PERFORMANCE | IN PROGRESS | scripts/soak-local.mjs; PERFORMANCE.md; evidence/soak*.txt | Process-tree RSS/FD/CPU measurement, latency/token/CLI comparison |
| G13 ACCESSIBILITY/MOBILE | NOT STARTED | Original MCP preserves role-based click; batch CSS only | Versioned selector AST, accessible assertions, touch/media fixtures |
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
  mutation-after-validation URL bypass (test reproduced before fix). Versioned AST pending.
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
