# Mandatory scenario evidence

Latest completed native `94d7cd4`: **999 tests passed/five failed**, zero test
skips/cancellations. Wrapper39568334026:278/3; batch39568334110:721/2. All five
test failures are Windows Firefox: original iframe/large-DOM/network-console
cases, supervised20-click workflow and429 navigation. Separately, Windows actual
Codex startup/discovery succeeded but its primary job ended CRASHED without a
result; Linux36.789s/macOS75.579s actual Codex1,000-action checks pass.

The matched raw Firefox probe passes ten fresh runs/230 actions each with logging
off/on on Windows, zero owned survivors. The passing logged case still records
removeProgressListener. This narrows evidence but does not identify the failure
cause: private temp storage, process observation and workload differ. Strict
failing cases remain. Installed143-file packages pass all native OSs; Windows
startup SDK/helper controls pass. GitHub's temporary401 outage is resolved.
Local follow-ups add sanitized guardian diagnostics, verify their146-file production
package, measure the released official CLI, and verify100 fresh cookie/localStorage
runs plus witnessed navigation deadline. These follow-ups await native validation.
Evidence: `evidence/worker-ci-thirtyeighth-*-tests.txt` and
`evidence/worker-ci-thirtyeighth-counts.jsonl`. **Not release-ready.**


This maps section 22 of the master prompt. Scoped evidence is not a release gate
PASS. Previous completed native `fd9d074`: **1,002 tests passed,five failed**, zero test
skips/cancellations. Wrapper39564493704:282/2; batch39564493658:720/3. All five
failures are Windows Firefox: raw Node22 headless/headed,429 fixture,and two
legacy Node20 modes. All92 original cases per OS pass, including100 fast clicks
through the preserved upstream trusted-code tool on every native engine. Docker,
all durable components, installed endpoints and source1,000-action jobs pass.

Actual Codex six-tool1,000-action/owner/dedup/cancel/cleanup checks pass again:
Windows37.871s(start24ms),Linux35.718s,macOS72.735s, zero model turns/survivors.
Framework JSON startup remains fixed. Primitive four-factor Firefox controls
again pass400 clicks/20 launches; they do not reproduce strict ten-run failures.
The next failure-only probe invokes the actual raw runner for ten fresh runs each
with logging off/on, no per-browser audit ACK pause, private temporary storage,
and independent ownership/cleanup checks. Local two-case460-action controls and
Linux operator-SIGTERM cleanup pass; native execution is pending.

Minimum runtime work: Node22.13.0 components41/41 and fresh142-file production
package pass after fixing two test-fixture IPC listeners; Node24 components41/41
also pass. A separate guard defect advertised support on Node23.0 without SQLite;
local fix rejects early23.x before writes(4 tests) and Node23.4 components41/41
pass. These follow-ups are not yet natively verified. Matrix17 jobs; last full
green d71c91e (14). Quotas,retention,profiles,egress,reliability and remaining
acceptance remain open.

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
| 9 | 100 reset workflows without carryover | PARTIAL: Linux supervised100 fresh executions/600 actions now assert empty cookie/localStorage state then positively seed/read both every run; zero owned survivors, FD/RSS thresholds pass. Managed reused-profile reset, other stores and native100-run acceptance remain. |
| 10 | Concurrent queued jobs + screenshot ownership | PARTIAL: durable FIFO/controller pressure and two installed queued jobs pass; public POSIX preview executes1,000 actions and prevents duplicate starts. New Linux Node22/24 public two-owner concurrent-start acceptance proves distinct PNGs, cross-owner denial, deletion preserving the other image, dedup after cleanup and zero owned survivors. Native confirmation and automatic retention remain. |
| 11 | Client/project ownership | PARTIAL: public POSIX MCP foreign-owner denial, trusted project namespace config and journal owner/project fencing pass. Jobs profiles and Windows ACLs remain unfinished. |
| 12 | Cancel during launch and locator wait | PARTIAL: injected stalled launch/late close, blocked worker and active real navigation; local trusted witness now proves cancellation after a real Chromium locator wait becomes pending, one confirmed action, bounded cleanup and independent zero survivors; native locator fixture and other phases remain. |
| 13 | Stdio close during browser run | PARTIAL: real EOF tests; 9041497 native Windows EOF/SIGTERM/abrupt-host cleanup passed; broader shutdown phase coverage remains. |
| 14 | SIGINT/SIGTERM + intact journal | PARTIAL: real foreground CLI SIGTERM persists CANCELLED after1 action with zero active owned processes; actual controller SIGKILL installed proof and journal rollback pass. Broader phase-specific crashes remain. |
| 15 | Browser crash during screenshot | PARTIAL: trusted fixture starts a real Chromium screenshot, verifies its promise is pending, kills only its own BrowserServer child handle, then requires screenshot failure, no PNG/temp publication and independently observed zero owned survivors. Local Node22/24 proof; native cross-OS confirmation pending. |
| 16 | Slow navigation deadline + cleanup | PARTIAL: real browser locator deadline, hanging navigation cancellation and a local Chromium main-thread tight-loop fixture;10s independent boundary returns before12s with zero owned survivors. Native frozen-page fixture passed. New Linux Node20/22 witnessed stalled navigation test passes: timeout, zero completed/no replay/next-step request, terminated/removed cleanup and zero owned survivors; native slow-navigation confirmation remains. |
| 17 | Invalid/extra/empty/oversized input | Verified strict validation, empty fill operator fixture, 1 MiB file limit and SDK 10 MiB frame guard/shutdown tests; not a general fuzzing proof. |
| 18 | Approved-to-denied redirect | Verified real Chromium/Firefox/WebKit CI fixtures. All redirects are rejected, including same-origin. |
| 19 | Unknown localhost port | Verified exact-origin unit policy and real redirect-to-denied-port hit counter. |
| 20 | Credentials, IPv6, encodings, file URLs | PARTIAL: credentials/file/unknown IPv6 loopback covered; decimal/hex/octal/short/percent-encoded localhost alias controls pass real Chromium/Firefox and cannot cross an unapproved port; full IPv6/encoding adversarial matrix and DNS controls remain. |
| 21 | Upload symlink escape | PARTIAL: original upload outside/symlink/junction negatives passed all native browsers at 9e73a08; earlier macOS modal timeout remains unexplained. Companion has no upload action. |
| 22 | Popup/iframe/WebSocket policy | PARTIAL: iframe and WebSocket zero-hit fixtures pass; popup approved/denied positive-control fixtures pass local Chromium/Firefox; native all-engine positive/negative cases pass at ebdec88. |
| 23 | Service worker limitation | PARTIAL: dedicated Chromium fixture proves approved positive control registers and reaches its target; strict runtime requests neither worker script nor target, verifies cleanup. Other engines and native new fixture remain pending. |
| 24 | 20-run artifact uniqueness + retention | PARTIAL: unique private artifacts and bounded dry-run/delete terminal cleanup pass locally, including unsafe-link/limit guards. Host-controlled per-run screenshot payload budgets now pass scoped tests; total storage quotas and retention remain absent. |
| 25 | Input/header secret canaries | PARTIAL: fill/error/report/protocol canaries tested; header and all artifact channels remain. |
| 26 | HTTP errors vs JS exceptions | PARTIAL: status/Retry-After taxonomy and sanitized generic failures tested; complete real-response/exception matrix remains. |
| 27 | Retry-After backoff + no unsafe replay | PARTIAL: configured GET-only 429/503 Retry-After backoff and no unsafe-action replay tests/installed smoke pass. Native Windows Firefox intermittency and the full retry taxonomy remain open. |
| 28 | CSS/test-id/role-name locators | PARTIAL: validator/resolver tests, real role/name 997 clicks and label operator fixture; full real locator/ambiguity matrix remains. |
| 29 | Dialog/popup/cross-frame behavior | PARTIAL: original dialog/frame and stale-target negatives passed native matrix at 9e73a08; earlier modal intermittency remains unexplained. Original popup list/select/interact/close/opener behavior passes local Chromium/Firefox; native all-engine fixture passed at ebdec88. |
| 30 | Mobile touch/viewport/DPI | PARTIAL: local Chromium mobile viewport/DPI/actual touch and CSS-scale PNG390x844 pass; Firefox explicit desktop viewport plus touch passes. Native all-engine coverage passed at c7ae948; no physical mobile claim. |
| 31 | Held/repeated keyboard/canvas input | PARTIAL: original ARIA labels, Tab focus order, Enter and Space activation pass local Chromium/Firefox. Local Chromium/Firefox held-pointer canvas pixel proof and repeated ArrowRight/Shift chord checks verify balanced key down/up, released modifiers and exact selection; native all-engine fixture passed at b6a91b9. |
| 32 | Dark mode/reduced motion | PARTIAL: local original Chromium/Firefox CSS phenotype switches and resets for dark/light and reduce/no-preference pass. Native all-engine coverage passed at c7ae948. |
| 33 | Bounded console/request errors | PARTIAL: companion suppresses page logs; original local Chromium/Firefox fixtures distinguish HTTP404 from JS exceptions, filter console severity and save20KiB+ logs through explicit filename with a short tool link. Default output/heap bounds and native new fixtures remain. |
| 34 | Isolated storage + project persistence | PARTIAL: original persistent-cookie/localStorage restore, sessionStorage end, exclusive profile lock and independent directory isolation passed native all-engine c7ae948. Jobs persistent profiles and secure managed reset remain absent. |
| 35 | Corrupt profile/lock diagnosis | OPEN: no companion profile manager. |
| 36 | Reconnect persistence or honest limitation | PARTIAL: public POSIX MCP/CLI IDs, duplicate keys, status/results, EOF cancellation and reconnect without replay pass. No daemon/resume; Windows private ACL helper verified; public integration pending; full G06 remains open. |
| 37 | CPU/RAM/process caps | OPEN: one active workflow and worker V8 heap cap are not total browser/process-tree quotas. |
| 38 | Soak RSS/handles/pages/FDs | PARTIAL: independent-observer100-run supervised Linux soak measures browser tree RSS/CPU lower bounds and subjectFD/RSS. Full browser FD access is kernel-denied; cross-OS and token comparisons remain. |
| 39 | Original screenshot/network/storage/PDF/video/trace | PARTIAL: PNG/PDF/WebM/trace/storage/tabs native behavior passed; network404 body/details, status200/404 listing, invalid filter and console file output pass local Chromium/Firefox; native new fixture and remaining negative capability coverage remain. |
| 40 | Default stdio listener audit | PARTIAL: no public companion HTTP transport. Active supervised execution uses a private loopback BrowserServer protocol allowed by master section 0; Linux Node24 operator probe initializes all three stdio endpoints (25/1/6 tools), maps socket inodes only from four live owned processes, finds zero TCP/IPv6 TCP listeners and verifies zero owned processes after shutdown. New Linux Node22/24 active supervised browser snapshots attribute one exact-loopback worker TCP listener across eight owned processes with complete readable FD coverage; cancellation leaves zero owned survivors. Native OS listener audits and broader egress controls remain. |
| 41 | Local CLI without connected model | Verified local 26-operation fixture, exact counter, report and canary absence; installed browsers/dependencies required. Not an OS air-gap audit. |
| 42 | Large DOM bounded representation | PARTIAL: batch returns last ten metadata steps and no DOM; local Chromium/Firefox4,000-button fixture saves a full snapshot above64KiB while explicit file responses stay below4096 characters; bounded browser_find returns actionable references and confirms a real last-row click. This uses operator-selected snapshot-mode=none; default inline/heap bounds remain open and native all-engine file/find fixture passed at b6a91b9. |
| 43 | Repeated suites, explained flakiness | PARTIAL: failed runs preserved; latest c7ae948 has a Windows Firefox direct-pipe failure plus a Windows installed process-audit failure. macOS CLI alias fix and native profile guard pass. No full native resolution. |
| 44 | Main/release blocked until evidence | PARTIAL: publishing disabled and PR remains draft; branch-protection API returned 403, enforcement not verified. No main merge. |
| 45 | Documented setup with no global MCP config | PARTIAL: actual temporary-config Codex and installed paths with spaces; native Bash/PowerShell bootstraps pass at 5264cb6; native Codex operator walkthroughs remain incomplete. |

Sources: CODEX_EXECUTION_LEDGER.md, CODEX_EXECUTION_REPORT.md, tests/*.spec.ts,
local-batch/*.test.mjs, scripts/verify-package.mjs and versioned docs/evidence.
No pending, failed or cancelled run is counted as a complete green matrix.
