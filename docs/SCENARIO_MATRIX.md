# Mandatory scenario evidence

This maps section 22 of the master prompt. Scoped evidence is not a release gate
PASS. Latest completed native candidate 9e73a08 has 483 passes and one strict
Windows raw Firefox cleanup failure. Last complete green is d71c91e (469, all
14 jobs). Internal guardian/diagnostic changes need native verification. Earlier
intermittent failures remain recorded and are not fully explained. OPEN means no adequate proof;
PARTIAL means the remaining condition is still mandatory.

| # | Scenario | Status and concrete evidence / gap |
|---|---|---|
| 1 | Fresh Ubuntu clone/install/upstream launch | Verified in native checkout and installed-package smoke; 9041497 Linux Node 20/22/24 jobs passed. |
| 2 | Windows PowerShell bootstrap + stdio | Verified native PowerShell bootstrap at 5264cb6: 53 passed, including installed real endpoints and owned shutdown; interactive Codex walkthrough remains scenario 45. |
| 3 | macOS Bash bootstrap + browser | Verified native Bash bootstrap at 5264cb6: 53 passed, real Chromium/Firefox/WebKit and owned cleanup; interactive Codex walkthrough remains scenario 45. |
| 4 | Production install without devDependencies | Verified by verify-package.mjs and production-smoke.mjs, real calls through both installed endpoints. |
| 5 | Companion included in tarball | Verified explicit runtime-entry checks, including supervisor/worker/cleanup modules. |
| 6 | Fork cannot publish Microsoft artifact | Verified private package, refusal script, disabled inherited publisher and distribution.test.mjs. No publish attempted. |
| 7 | Clean Codex initialization/discovery/navigation | Verified temporary app-server config, ephemeral thread, both endpoints; worker-codex-97f3c57 evidence (1,000 actions in 34.021s). No global config changes. |
| 8 | Exact 1,000 operations + final counter | Verified real MCP/Codex fixture: goto, 997 clicks, exact count and exact URL, one positive batch call. Not 1,000 clicks. |
| 9 | 100 reset workflows without carryover | PARTIAL: 100 fresh raw-runner workflows measured; explicit state-reset/cookie carryover acceptance remains. |
| 10 | Concurrent queued jobs + screenshot ownership | PARTIAL: 20 unique screenshot runs and busy rejection; durable queue not implemented. |
| 11 | Client/project ownership | PARTIAL: internal journal owner isolation and project marker fencing tests; no public job/profile endpoint or cross-client MCP ownership proof. |
| 12 | Cancel during launch and locator wait | PARTIAL: injected stalled launch/late close, blocked worker and active real navigation; extend real phase-specific cancellation. |
| 13 | Stdio close during browser run | PARTIAL: real EOF tests; 9041497 native Windows EOF/SIGTERM/abrupt-host cleanup passed; broader shutdown phase coverage remains. |
| 14 | SIGINT/SIGTERM + intact journal | PARTIAL: native SIGTERM/EOF/guardian ownership plus journal killed-transaction rollback and recovery; durable execution integration remains absent. |
| 15 | Browser crash during screenshot | OPEN: worker crash fixture is not a real browser crash during screenshot. |
| 16 | Slow navigation deadline + cleanup | PARTIAL: real browser locator deadline and hanging navigation cancellation; add explicit navigation-timeout acceptance. |
| 17 | Invalid/extra/empty/oversized input | Verified strict validation, empty fill operator fixture, 1 MiB file limit and SDK 10 MiB frame guard/shutdown tests; not a general fuzzing proof. |
| 18 | Approved-to-denied redirect | Verified real Chromium/Firefox/WebKit CI fixtures. All redirects are rejected, including same-origin. |
| 19 | Unknown localhost port | Verified exact-origin unit policy and real redirect-to-denied-port hit counter. |
| 20 | Credentials, IPv6, encodings, file URLs | PARTIAL: credentials/file/unknown IPv6 loopback covered; complete encoding/canonicalization adversarial matrix remains. |
| 21 | Upload symlink escape | PARTIAL: original upload outside/symlink/junction negatives passed all native browsers at 9e73a08; earlier macOS modal timeout remains unexplained. Companion has no upload action. |
| 22 | Popup/iframe/WebSocket policy | PARTIAL: iframe and WebSocket zero-hit fixtures pass; popup policy proof remains. |
| 23 | Service worker limitation | OPEN: disabled in context options; dedicated hostile worker fixture still required. |
| 24 | 20-run artifact uniqueness + retention | PARTIAL: uniqueness/private POSIX dirs and ignore rules proved; retention/quota policy absent. |
| 25 | Input/header secret canaries | PARTIAL: fill/error/report/protocol canaries tested; header and all artifact channels remain. |
| 26 | HTTP errors vs JS exceptions | PARTIAL: status/Retry-After taxonomy and sanitized generic failures tested; complete real-response/exception matrix remains. |
| 27 | Retry-After backoff + no unsafe replay | PARTIAL: metadata and maxRetries=0; report-fault fixture proves no navigation replay. Backoff scheduler absent. |
| 28 | CSS/test-id/role-name locators | PARTIAL: validator/resolver tests, real role/name 997 clicks and label operator fixture; full real locator/ambiguity matrix remains. |
| 29 | Dialog/popup/cross-frame behavior | PARTIAL: original dialog/frame and stale-target negatives passed native matrix at 9e73a08; earlier modal intermittency remains unexplained. Popup behavior proof remains. |
| 30 | Mobile touch/viewport/DPI | OPEN: no executed mobile acceptance fixture. |
| 31 | Held/repeated keyboard/canvas input | OPEN: no full hold/release/repeated-Space fixture. |
| 32 | Dark mode/reduced motion | OPEN: discovery retains upstream capability; behavior not proved. |
| 33 | Bounded console/request errors | PARTIAL: companion suppresses page logs; upstream console/network output behavior and large/error bounds still need fixtures. |
| 34 | Isolated storage + project persistence | PARTIAL: original cookie/localStorage functions verified; companion persistent profiles absent. |
| 35 | Corrupt profile/lock diagnosis | OPEN: no companion profile manager. |
| 36 | Reconnect persistence or honest limitation | LIMITATION documented: internal journal and trusted guardian bridge exist; public jobs/queue/controller/reconnect is unfinished. This does not pass G06. |
| 37 | CPU/RAM/process caps | OPEN: one active workflow and worker V8 heap cap are not total browser/process-tree quotas. |
| 38 | Soak RSS/handles/pages/FDs | PARTIAL: old raw-runner 100-run RSS samples; complete supervised process-tree measurements remain. |
| 39 | Original screenshot/network/storage/PDF/video/trace | PARTIAL: PNG/PDF/WebM/trace/storage/tabs native behavior passed; full network and negative capability coverage remains. |
| 40 | Default stdio listener audit | PARTIAL: no public companion HTTP transport. Active supervised execution uses a private loopback BrowserServer protocol allowed by master section 0; explicit port/cleanup audit remains. |
| 41 | Local CLI without connected model | Verified local 26-operation fixture, exact counter, report and canary absence; installed browsers/dependencies required. Not an OS air-gap audit. |
| 42 | Large DOM bounded representation | PARTIAL: batch returns last ten metadata steps and no DOM; original large-snapshot limits remain untested. |
| 43 | Repeated suites, explained flakiness | PARTIAL: all failed runs preserved. Windows cleanup-only classification reconciled with resource proof and native pass; latest macOS modal timeout and earlier browser intermittency remain open. |
| 44 | Main/release blocked until evidence | PARTIAL: publishing disabled and PR remains draft; branch-protection API returned 403, enforcement not verified. No main merge. |
| 45 | Documented setup with no global MCP config | PARTIAL: actual temporary-config Codex and installed paths with spaces; native Bash/PowerShell bootstraps pass at 5264cb6; native Codex operator walkthroughs remain incomplete. |

Sources: CODEX_EXECUTION_LEDGER.md, CODEX_EXECUTION_REPORT.md, tests/*.spec.ts,
local-batch/*.test.mjs, scripts/verify-package.mjs and versioned docs/evidence.
No pending, failed or cancelled run is counted as a complete green matrix.
