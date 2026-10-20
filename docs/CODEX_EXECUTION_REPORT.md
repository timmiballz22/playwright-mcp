# Execution report — incomplete mission

Branch: feat/local-production-hardening. Draft PR:
https://github.com/timmiballz22/playwright-mcp/pull/2.
Baseline 804bc7e; first hardening commit a5a5a13; second 32477dd.
Implementation commit: 735ee47f9f70ca7f31997e54cb0a91b0a18ea1aa.
Follow-up test-only change fixes per-client argument isolation and records evidence.

Implemented: production SDK/tarball/fork identity safeguards, disabled publication,
exact operator origins, real redirect SSRF regression/fix, no redirect replay,
WebSocket/worker restrictions, launch deadline and late close, bounded cleanup,
EOF/SIGTERM handling, private per-run artifacts and capture consent, strict v1
workflow validation, accessible selectors, compact bounded action repeats, exact
text equality, safe HTTP status/Retry-After metadata, cross-platform test launcher,
CI limits/matrix, 72-tool schema records and upstream behavior fixtures.

Local commands and results (Linux, Node 24.19.0):
- npm ci: passed; npm run lint and git diff --check: passed.
- npm test -- --project=chromium --project=firefox --workers=2: 22 passed (latest isolation regression included).
- node scripts/test-batch.mjs: 24 passed, 2 FAILED (WebKit native libraries),
  0 skipped/cancelled. Includes real compact stdio MCP 1,000-operation workflow.
- node scripts/verify-package.mjs: independent omit-dev tarball install, 25 original
  and one companion tools discovered after both installed server handshakes.
- node scripts/discover-tools.mjs: 25 default / 72 extended schema records per
  configured browser; discovery alone does not prove browser behavior.
- node scripts/soak-local.mjs: 100 fresh successful workflows, 18.041s, runner RSS
  118.3–182.5 MB. GC diagnostic 29.770s, 118.3–130.7 MB. Not leak-free proof.
- Node 22 unit/distribution/real MCP subset: 16 passed, 0 failed/skipped.
- npm audit --omit=dev: zero advisories after compatible transitive updates.

CI on a5a5a13: wrapper full native/Docker run passed (39474746316), batch Linux/
macOS passed, Windows failed literal wildcard before test execution (39474746024).
CI on 32477dd: Linux/macOS/Docker passed; Windows batch 21/22 (SIGTERM expectation),
wrapper 35/36 (cold branded Chrome stable-element timeout). Follow-up changes
correct Windows termination semantics and explicitly budget/serialize Chrome tests.
Latest required native CI still needs inspection; do not label it green prematurely.

G00–G18 status and exact next actions: CODEX_EXECUTION_LEDGER.md.
45-scenario scope: TEST_MATRIX.md. Raw selected logs: docs/evidence/.

NOT RELEASE-READY. Outstanding critical/P1 work includes durable jobs and queues,
process-tree cleanup guarantees, report I/O deadlines, profile ownership/recovery,
DNS/egress threat cases, approved redirect semantics, screenshot masking, artifact
quotas/retention, retry/backoff policy, robust assertions/AST, mobile/accessibility
matrix, real Codex operator setup, resource/token/CLI comparison and full CI.
No packages published, no main merge, no production actions performed.

## Final verified code milestone

Tested commit: 2321179bf52f79abe7986c8d6a2b133c46f1da5a.
Native batch CI: https://github.com/timmiballz22/playwright-mcp/actions/runs/39478123877
Native wrapper/Docker/lint CI: https://github.com/timmiballz22/playwright-mcp/actions/runs/39478123906
All eight jobs succeeded: 26 batch + 44 wrapper tests per Linux/macOS/Windows,
plus 2 Docker tests = 212 passed, 0 failed/skipped/cancelled in final CI.
Windows uses one wrapper worker and an explicit 15s Chrome action/60s test
budget; production defaults are unchanged. Repeated cold Windows Chrome
reliability remains a follow-up, not silently dismissed as a fixed engine bug.

Actual Codex CLI 0.163.0 app-server: both stdio endpoints discovered, original
local navigation passed, compact one-call 1,000-operation batch passed in 33.882s,
zero model turns. Plain CLI: 26 operations and canary/report checks passed.
Separate original 804bc7e baseline: 8 tests passed using managed Chromium and
all six complete tool schema records unchanged. Raw operator scripts/results and
CI summaries are under docs/evidence.

The final evidence/gitignore follow-up changes no runtime or tests, and deliberately
skips duplicate CI. The tested code SHA and executed results above remain explicit.
G04/G10/G15 verified; other gates remain partial/failed as detailed in the ledger.
No release-ready claim, publication, main merge, or production action.

Reproduce tested code:

```bash
git clone --branch feat/local-production-hardening https://github.com/timmiballz22/playwright-mcp.git
cd playwright-mcp
git checkout 2321179bf52f79abe7986c8d6a2b133c46f1da5a
npm ci
npx playwright install --with-deps chromium firefox webkit chrome
npm test
npm run test:batch
node scripts/verify-package.mjs
```

Browser system dependency installation can require administrator access. The
local container could not install those dependencies; native CI provides the
complete browser matrix. Node 18 support is unverified despite inherited engine
metadata; prefer the tested current Node 22/24 runtimes for local operation.
