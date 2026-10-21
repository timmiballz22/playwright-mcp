# Mandatory scenario evidence

This maps section 22 of the master prompt. Scoped evidence is not a release gate
PASS. Latest completed native c7ae948 has704 test passes/one failure plus a
Windows installed-package verification failure before its browser suite. All68
original wrapper tests passed on each OS, including profile contention/restore,
keyboard/media and upload/frame fixtures; Docker passed2/2. Legacy Windows
Node20 Firefox direct-pipe still failed. The next candidate's creation-time
process audit and unwired ACL prototype await native confirmation. Last full
green remains d71c91e(469). Earlier failures remain retained. OPEN means no
adequate proof; PARTIAL means required work remains.

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
| 10 | Concurrent queued jobs + screenshot ownership | PARTIAL: durable FIFO/controller pressure and two installed queued jobs pass; public POSIX preview executes1,000 actions and prevents duplicate starts. Concurrent screenshot/retention acceptance remains. |
| 11 | Client/project ownership | PARTIAL: public POSIX MCP foreign-owner denial, trusted project namespace config and journal owner/project fencing pass. Jobs profiles and Windows ACLs remain unfinished. |
| 12 | Cancel during launch and locator wait | PARTIAL: injected stalled launch/late close, blocked worker and active real navigation; extend real phase-specific cancellation. |
| 13 | Stdio close during browser run | PARTIAL: real EOF tests; 9041497 native Windows EOF/SIGTERM/abrupt-host cleanup passed; broader shutdown phase coverage remains. |
| 14 | SIGINT/SIGTERM + intact journal | PARTIAL: real foreground CLI SIGTERM persists CANCELLED after1 action with zero active owned processes; actual controller SIGKILL installed proof and journal rollback pass. Broader phase-specific crashes remain. |
| 15 | Browser crash during screenshot | PARTIAL: trusted fixture starts a real Chromium screenshot, verifies its promise is pending, kills only its own BrowserServer child handle, then requires screenshot failure, no PNG/temp publication and independently observed zero owned survivors. Local Node22/24 proof; native cross-OS confirmation pending. |
| 16 | Slow navigation deadline + cleanup | PARTIAL: real browser locator deadline, hanging navigation cancellation and a local Chromium main-thread tight-loop fixture;10s independent boundary returns before12s with zero owned survivors. Native frozen-page fixture and explicit navigation-timeout acceptance remain. |
| 17 | Invalid/extra/empty/oversized input | Verified strict validation, empty fill operator fixture, 1 MiB file limit and SDK 10 MiB frame guard/shutdown tests; not a general fuzzing proof. |
| 18 | Approved-to-denied redirect | Verified real Chromium/Firefox/WebKit CI fixtures. All redirects are rejected, including same-origin. |
| 19 | Unknown localhost port | Verified exact-origin unit policy and real redirect-to-denied-port hit counter. |
| 20 | Credentials, IPv6, encodings, file URLs | PARTIAL: credentials/file/unknown IPv6 loopback covered; complete encoding/canonicalization adversarial matrix remains. |
| 21 | Upload symlink escape | PARTIAL: original upload outside/symlink/junction negatives passed all native browsers at 9e73a08; earlier macOS modal timeout remains unexplained. Companion has no upload action. |
| 22 | Popup/iframe/WebSocket policy | PARTIAL: iframe and WebSocket zero-hit fixtures pass; popup approved/denied positive-control fixtures pass local Chromium/Firefox; native WebKit confirmation remains. |
| 23 | Service worker limitation | PARTIAL: dedicated Chromium fixture proves approved positive control registers and reaches its target; strict runtime requests neither worker script nor target, verifies cleanup. Other engines and native new fixture remain pending. |
| 24 | 20-run artifact uniqueness + retention | PARTIAL: unique private artifacts and bounded dry-run/delete terminal cleanup pass locally, including unsafe-link/limit guards. Host-controlled per-run screenshot payload budgets now pass scoped tests; total storage quotas and retention remain absent. |
| 25 | Input/header secret canaries | PARTIAL: fill/error/report/protocol canaries tested; header and all artifact channels remain. |
| 26 | HTTP errors vs JS exceptions | PARTIAL: status/Retry-After taxonomy and sanitized generic failures tested; complete real-response/exception matrix remains. |
| 27 | Retry-After backoff + no unsafe replay | PARTIAL: configured GET-only 429/503 Retry-After backoff and no unsafe-action replay tests/installed smoke pass. Native Windows Firefox intermittency and the full retry taxonomy remain open. |
| 28 | CSS/test-id/role-name locators | PARTIAL: validator/resolver tests, real role/name 997 clicks and label operator fixture; full real locator/ambiguity matrix remains. |
| 29 | Dialog/popup/cross-frame behavior | PARTIAL: original dialog/frame and stale-target negatives passed native matrix at 9e73a08; earlier modal intermittency remains unexplained. Original popup list/select/interact/close/opener behavior passes local Chromium/Firefox; native new fixture pending. |
| 30 | Mobile touch/viewport/DPI | PARTIAL: local Chromium mobile viewport/DPI/actual touch and CSS-scale PNG390x844 pass; Firefox explicit desktop viewport plus touch passes. Native all-engine coverage passed at c7ae948; no physical mobile claim. |
| 31 | Held/repeated keyboard/canvas input | PARTIAL: original ARIA labels, Tab focus order, Enter and Space activation pass local Chromium/Firefox. Hold/release/repeated input and canvas fixtures remain. |
| 32 | Dark mode/reduced motion | PARTIAL: local original Chromium/Firefox CSS phenotype switches and resets for dark/light and reduce/no-preference pass. Native all-engine coverage passed at c7ae948. |
| 33 | Bounded console/request errors | PARTIAL: companion suppresses page logs; original local Chromium/Firefox fixtures distinguish HTTP404 from JS exceptions, filter console severity and save20KiB+ logs through explicit filename with a short tool link. Default output/heap bounds and native new fixtures remain. |
| 34 | Isolated storage + project persistence | PARTIAL: original persistent-cookie/localStorage restore, sessionStorage end, exclusive profile lock and independent directory isolation passed native all-engine c7ae948. Jobs persistent profiles and secure managed reset remain absent. |
| 35 | Corrupt profile/lock diagnosis | OPEN: no companion profile manager. |
| 36 | Reconnect persistence or honest limitation | PARTIAL: public POSIX MCP/CLI IDs, duplicate keys, status/results, EOF cancellation and reconnect without replay pass. No daemon/resume; Windows private storage unsupported; full G06 remains open. |
| 37 | CPU/RAM/process caps | OPEN: one active workflow and worker V8 heap cap are not total browser/process-tree quotas. |
| 38 | Soak RSS/handles/pages/FDs | PARTIAL: independent-observer100-run supervised Linux soak measures browser tree RSS/CPU lower bounds and subjectFD/RSS. Full browser FD access is kernel-denied; cross-OS and token comparisons remain. |
| 39 | Original screenshot/network/storage/PDF/video/trace | PARTIAL: PNG/PDF/WebM/trace/storage/tabs native behavior passed; network404 body/details, status200/404 listing, invalid filter and console file output pass local Chromium/Firefox; native new fixture and remaining negative capability coverage remain. |
| 40 | Default stdio listener audit | PARTIAL: no public companion HTTP transport. Active supervised execution uses a private loopback BrowserServer protocol allowed by master section 0; explicit port/cleanup audit remains. |
| 41 | Local CLI without connected model | Verified local 26-operation fixture, exact counter, report and canary absence; installed browsers/dependencies required. Not an OS air-gap audit. |
| 42 | Large DOM bounded representation | PARTIAL: batch returns last ten metadata steps and no DOM; original large-snapshot limits remain untested. |
| 43 | Repeated suites, explained flakiness | PARTIAL: failed runs preserved; latest c7ae948 has a Windows Firefox direct-pipe failure plus a Windows installed process-audit failure. macOS CLI alias fix and native profile guard pass. No full native resolution. |
| 44 | Main/release blocked until evidence | PARTIAL: publishing disabled and PR remains draft; branch-protection API returned 403, enforcement not verified. No main merge. |
| 45 | Documented setup with no global MCP config | PARTIAL: actual temporary-config Codex and installed paths with spaces; native Bash/PowerShell bootstraps pass at 5264cb6; native Codex operator walkthroughs remain incomplete. |

Sources: CODEX_EXECUTION_LEDGER.md, CODEX_EXECUTION_REPORT.md, tests/*.spec.ts,
local-batch/*.test.mjs, scripts/verify-package.mjs and versioned docs/evidence.
No pending, failed or cancelled run is counted as a complete green matrix.
