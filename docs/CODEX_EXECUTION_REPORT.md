# Execution report — verified milestone, incomplete mission

Tested code: `2321179bf52f79abe7986c8d6a2b133c46f1da5a`.
Branch: `feat/local-production-hardening`.
Draft PR: https://github.com/timmiballz22/playwright-mcp/pull/2.
Documentation/gitignore follow-ups change no runtime or test behavior and skip
redundant CI; executed PASS results below apply to the explicit tested SHA.

## Changes

Promoted runtime SDK, included companion files in private fork tarballs, removed
inherited publishing, required exact operator origins, reproduced/fixed redirect
SSRF, and disabled redirect following/request replay. Added lifecycle launch
bounds and late cleanup, actual EOF/SIGTERM shutdown, private per-run artifacts,
capture approval, strict workflow v1, accessible selectors, bounded explicit
repeats, exact text equality and safe HTTP status/Retry-After metadata.

Original cli.js/index.js runtime delegation is unchanged. All six complete
browser/capability discovery records match baseline 804bc7e: 25 default and 72
extended tools. Added original storage, screenshot, trace, video, tab and Chromium
PDF behavior tests. Fixed per-client test argument mutation, Windows wildcard
execution, POSIX-only signal assumptions and bounded Windows Chrome test budgets.

## Executed verification

- [Batch CI](https://github.com/timmiballz22/playwright-mcp/actions/runs/39478123877):
  Linux/macOS/Windows, 26 passed each; Chromium/Firefox/WebKit positive fixtures.
- [Wrapper/Docker/lint CI](https://github.com/timmiballz22/playwright-mcp/actions/runs/39478123906):
  Linux/macOS/Windows, 44 passed each; Chrome/Chromium/Firefox/WebKit projects;
  Docker 2 passed; lint passed.
- Final CI: all eight configured jobs succeeded, **212 passed, 0 failed,
  0 skipped/cancelled**. Earlier failed/cancelled runs remain recorded in the ledger.
- Local Node 24.19.0: wrapper Chromium/Firefox 22 passed; companion 24 passed,
  2 FAILED because this container cannot launch WebKit, 0 skipped/cancelled.
  Native CI supplies real WebKit coverage; local failure is not relabeled PASS.
- Node 22.23.3: unit/distribution/real MCP subset 16 passed, 0 failed/skipped.
- Fresh production tarball install without devDependencies: both stdio handshakes,
  ping and discovery passed on all three native OS CI jobs.
- Original detached 804bc7e baseline: all 8 existing tests passed with explicit
  managed Chromium; default branded Chrome remains unavailable locally. Six full
  discovery schema comparisons are unchanged.
- Actual Codex CLI 0.163.0 app-server: both endpoints discovered, original local
  navigation and one compact 1,000-operation batch call passed in 33.882s, zero
  model turns. Temporary config overrides/ephemeral thread; global config unchanged.
- Plain Linux CLI fixture: 26 operations, empty fill/check/uncheck, accessible
  selectors, exact final counter, report write and seeded-input redaction passed.
- npm audit --omit=dev: zero advisories after compatible transitive updates.
  git diff --check and sensitive upstream-output gitignore check passed.

Core commands: npm ci; npm run lint; npm test; npm run test:batch;
node scripts/verify-package.mjs; node scripts/discover-tools.mjs;
node scripts/soak-local.mjs; node --expose-gc scripts/soak-local.mjs.
Exact local subset commands, operator scripts/results and raw selected CI counts
are in docs/evidence and CODEX_EXECUTION_LEDGER.md.

Windows wrapper CI uses one worker, 15s Chrome action/60s test bounds; production
defaults remain unchanged. Repeated cold Windows Chrome reliability remains open.
Actual Codex/CLI operator testing above is Linux-only; native Windows/macOS
interactive Codex and bootstrap walkthroughs are not certified by SDK CI jobs.

## Measurements and limits

100 fresh successful workflows: 18.041s; runner RSS 118.3–182.5 MB. Explicit-GC
diagnostic: 29.770s; RSS 118.3–130.7 MB. These earlier samples do not prove leak-free
browser process trees, FD bounds or statistical reliability. See PERFORMANCE.md.

The Codex fixture expands four declarations into 1,000 actions: goto, 997 clicks,
exact text and URL assertions. Representative equivalent argument JSON is 60,952
bytes inline versus 209 with repeat; this is not a tokenizer/model-cost estimate.
Normal conversational automation still consumes client/model allowances.

## Gate status and remaining work

G04/G10/G15 have verified evidence. Every G00–G18 status, source reference and NEXT
ACTION is tracked in CODEX_EXECUTION_LEDGER.md; all 45 scenarios are scoped in
TEST_MATRIX.md. **NOT RELEASE-READY.**

Outstanding: isolated worker ownership and full process/report deadlines, DNS/
egress guards, response byte/memory quotas, durable jobs/queues, profile locks and
recovery, retention, approved redirects, capture masking, backoff, stronger
assertions/control flow, mobile/keyboard/media/advanced negative fixtures,
remaining operator coverage, and CPU/RAM/token/CLI comparison. Branch protection
is unverified (API 403). No package publication, main merge or production action.

## Reproduction

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

Browser system dependencies may require administrator access. Node 18 support is
unverified despite inherited engine metadata; prefer tested Node 22/24 locally.

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
