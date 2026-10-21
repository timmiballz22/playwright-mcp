# Current acceptance coverage

[SCENARIO_MATRIX.md](SCENARIO_MATRIX.md) is the current45-scenario map;
[CODEX_EXECUTION_LEDGER.md](CODEX_EXECUTION_LEDGER.md) records exact candidates and
commands. Latest completed native667190a:601 test passes/3 Windows Firefox test failures,
plus a macOS installed-package failure before its browser suite. CLI alias fix
and new parity/security coverage await native confirmation. Public POSIX jobs MCP,
foreground CLI and bounded terminal cleanup are previews; Windows private storage,
profiles, full quotas/retention and egress controls remain open. No release-ready
claim follows from local scoped passes.

The following table is historical and predates the durable controller, public
preview, configured navigation retries and independent-observer soak. It is
retained for traceability; use the linked current map for present scope.

# Historical snapshot before durable jobs

This table preserves an early baseline; it is not current HEAD status. Current
scenario status is maintained in SCENARIO_MATRIX.md.

The full 45 required scenarios and 72 tool families are defined in
CODEX_ULTIMATE_MASTER_PROMPT.md; the ledger tracks G00–G18.

| Scenarios | Current evidence |
|---|---|
| 1 | Linux npm ci passes; original branded Chrome absent locally; Chromium/Firefox projects pass |
| 2–3 | Windows/macOS CI configured; results required |
| 4–6 | Fresh production tarball install + discovery smoke; private fork identity and disabled publication test |
| 7 | SDK stdio handshake + local browser workflow; actual Codex interactive client not verified |
| 8 | Real 1,000-operation Chromium fixture; 997 clicks, exact final count |
| 9 | 100 fresh workflows with state reset; soak logs |
| 10–11 | NOT TESTED; jobs/concurrent owner isolation not implemented |
| 12 | Stalled launch deadline/late close tested with injection; real locator cancellation pending |
| 13–16 | Active EOF/SIGTERM exit tested; crash/process-tree/deadline cases incomplete |
| 17 | Invalid actions/unknown properties/limits tested; fuzz/oversize input pending |
| 18–20 | Redirect SSRF + exact localhost origins + file/URL credentials negative tests; all encodings pending |
| 21 | Upload absent from companion; upstream behavior still requires test |
| 22–23 | WebSockets closed and service workers blocked by code; browser negative fixtures pending |
| 24 | 20-run paired concurrent screenshots pass uniqueness/private-directory checks; retention absent |
| 25 | Fake secret error scrubbed; screenshots not masked; NOT COMPLETE |
| 26–27 | NOT IMPLEMENTED: status taxonomy and Retry-After handling |
| 28–33 | CSS and upstream role click tested; remaining interaction/mobile/console scenarios NOT TESTED |
| 34–36 | Ephemeral fresh state tested; persistent profile/reconnect/crash recovery NOT TESTED |
| 37–38 | 100 sequential runs, runner RSS measured; process-tree caps/FD leak proof pending |
| 39 | All 72 schemas discoverable; original cookies/localStorage/screenshot/trace/video/tabs/PDF behavior added, full advanced matrix incomplete |
| 40 | Source uses stdio; actual OS listener enumeration NOT TESTED |
| 41 | CLI implementation present; fresh disconnected CLI operator test pending |
| 42 | MCP step results bounded to last 10; large DOM upstream snapshot behavior NOT TESTED |
| 43 | Repeated unit/integration runs passed; statistical flake audit pending |
| 44 | Publication disabled/private package; complete release-CI evidence gate pending |
| 45 | Source setup documented; clean real Codex operator validation pending |

Native CI at 2321179 executed real Chromium/Firefox/WebKit positive batch and
security fixtures on Linux/macOS/Windows (26/26 per OS). Wrapper projects Chrome,
Chromium, Firefox and WebKit passed 44/44 per OS; Docker 2/2. Local container
WebKit launch still FAILED on missing libraries. No physical iOS coverage, no substitution from mobile emulation.

Latest operator evidence: docs/evidence/cli-operator.txt and
codex-client-operator.txt prove Linux plain CLI and actual Codex app-server
configuration/discovery/navigation/1,000-operation tool call. No model turn was
started. Native Windows/macOS interactive Codex and bootstrap scripts are not
certified by these SDK/browser CI jobs.

Native c7ae948: wrapper39540474669 (211 pass/1 fail), batch39540476877
(493 pass/0 test fail plus Windows installed verification failure before batch
browser tests). All68 original tests per OS and Docker2 passed. Windows legacy
Node20 Firefox direct-pipe remains a failure. Creation-time-aware read-only
process auditing and an unwired Windows ACL prototype await native confirmation;
local Linux evidence is not Windows ACL proof. See worker-ci-twentyfourth evidence.

Additional candidate coverage: popup-policy.test.mjs uses an approved positive
control and denied-origin zero-hit case, with popup completion observed through
the opener. Chromium/Firefox pass locally; WebKit awaits native CI.
tests/popup.spec.ts independently preserves original popup selection, interaction,
close and opener behavior in local Chromium/Firefox. screenshot-crash.test.mjs
requires a real pending Chromium screenshot and successful scoped child-handle
termination, action failure without image/temp publication, supervisor cleanup
and an independent zero-survivor scan. This is a trusted fault fixture, not a new
workflow capability. Local Node22/24 evidence does not establish native Windows.

network-console.spec.ts passes local Chromium/Firefox: HTTP200/404 request
listing,404 response-body details, invalid-regex error, console severity filtering
including a real uncaught JS exception, and explicit20KiB+ console file output
with a response below4096 characters. It does not assert default console bounds.
The first fixture attempt used nonexistent setRoute; that test-authoring failure
is preserved, then corrected to this repository's route API.

frozen-page.test.mjs reaches an owned local page's freeze trigger, then runs a
real main-thread tight loop during a locator wait. The10s executor boundary
returns timeout before12s, confirms cleanup/temp removal and independently
checks zero owned survivors (local Node24). Native new fixture is pending.
Upstream issue43462 reproduces delayed waitForFunction timeout on frozen pages;
that report supports this separate failure-mode test, not a diagnosis of our
Windows simple-click Firefox stall. Issue34586 involved concurrent contexts and
was closed after an older Firefox roll; our fixture has one context per fresh
browser. No launch, graphics, security or driver settings were changed.

Native9e1371e:807 pass/six fail (wrapper210/2, batch597/4), zero test skips/
cancellations. All original68 per OS, Docker and installed packages pass.
Windows installed profile audit now passes; its former numeric-parent false
ownership case is addressed by live creation-time identity evidence. Windows
ACL helper creation/namespace calls succeeded, but independent Get-Acl could not
load Microsoft.PowerShell.Security. Test inspector is changed to direct .NET
ACL reads/writes of owned fixtures; no policy bypass or runtime ACL relaxation.
Three Windows raw Firefox loops still fail. macOS synchronous1,000-action MCP
expires with987 confirmed actions and verified cleanup; raw1,000-action fixture
passes in113.5s. Deadlines/assertions are retained, no failed input replayed.

encoded-origin.test.mjs approves a localhost target for six browser-canonical
aliases (normal, integer, hexadecimal, octal, shortened and percent-encoded),
then repeats with that port denied: all fetches settle, denied effect count is
zero, cleanup is verified. Local Chromium/Firefox pass; WebKit/native pending.

locator-cancel.test.mjs starts a real Chromium locator wait and requires a
private trusted witness that its promise is pending before host abort. It checks
CANCELLED/one confirmed action, no retry safety claim, bounded cleanup and an
independent process scan. Live-root creation-time evidence is recorded on
Windows before cancellation. Local Linux passes; native new fixture is pending.
Component CI now uses Bash pipefail with tee and uploads failed trusted component
logs for one day, pinned upload-artifact v4.6.2. It preserves the test exit code
and original assertions; public Windows bootstrap coverage remains PowerShell.

The real crash fixture initially failed on local Node20: its early IPC listener
consumed the start packet during dynamic worker import, so no workspace/witness
was created. Both phase fixtures now statically import the worker and prepend
the workspace witness before IPC delivery; entrypoint evaluation finishes before
messages dispatch. Locator witness publication also uses exclusive temporary
write plus rename after an observed empty-file race. Both real phase tests pass
Node20/22/24 with original assertions and cleanup scans intact. Before/initial/
after logs are preserved. These are trusted fixture fixes, not runtime policy or
execution-deadline changes. Fresh131-file production snapshot at346044f passes
all installed checks; later changes only fix trusted test-fixture setup.

Failure artifact capture now covers batch bootstrap and original-wrapper test
steps as well as durable components. Bash pipefail was checked with a controlled
exit3 fixture through tee (exit3 preserved); native PowerShell bootstrap still
throws on failed commands before its pipeline can succeed. YAML parses locally;
native artifact upload remains pending. Only trusted local test output is
captured, retained for one day, with upload-artifact pinned to v4.6.2.

Optional Linux Node22.13+ probe: `node scripts/verify-stdio-listeners.mjs [package]`.
It initializes original/batch/jobs stdio without browser work, discovers25/1/6
tools, maps TCP/TCP6 LISTEN socket inodes only from live owned process FDs and
verifies zero listeners plus zero owned processes after shutdown. Source Node24
passes (four owned Node processes). No global config, model turn or browser work.
It is not an active-browser, UDP, macOS or Windows socket audit; inaccessible
owned FD metadata fails instead of being treated as an empty result.

Nativeebdec88:870 pass/seven fail (wrapper235/1, batch635/6), zero test skips/
cancellations. All76 original tests per OS, Docker and installed packages pass.
Windows ACL helper positive/negative assertions pass independently. Component
failure is guardian journal_unavailable after its2s watchdog, not ACL failure;
command metadata is added to watchdog errors for diagnosis without budget/retry
changes. Other failures: Windows raw concurrent Chromium server close, four
Firefox cases, and Node20 crash-fixture missing witness (exact local reproduction
and static-import fix retained). macOS96 batch tests pass, including1,000-action
MCP with unchanged deadlines. Original popup/network/console and companion
popup/alias/frozen-page fixtures now have native proof.

Windows integration candidate: resolveJobConfig now uses the independently
native-tested SID/System ACL helper instead of unconditional rejection. Common
namespace/policy tests and a Windows junction-config negative exercise that
boundary; source public jobs and fresh installed MCP/CLI tests are enabled on
Windows. POSIX15 config/journal checks and six public/CLI/config cases pass,
including exact1,000-action workflow; Node20 six cases retain unsupported-job
runtime refusal before workflow/state writes. Fresh132-file production package
passes locally. Windows public integration awaits native acceptance. POSIX SIGTERM
handler tests remain POSIX-specific; Windows forced process termination is not
claimed to deliver the same completion event.

held-input.spec.ts passes local Chromium/Firefox: pointer-down state persists
across separate move tools and paints a sampled canvas pixel; mouse-up clears
held state exactly once. Two ArrowRight presses plus Shift+ArrowRight produce
four keydowns/four keyups, zero held keys and exact selection2–3. Native new
fixture is pending. Installed-package failures are also prepared for failure-only
log artifacts, so early startup failures can be inspected before a whole matrix
completes; native upload acceptance remains pending.

Raw runner close fallback: controlled hanging BrowserServer.close previously
returns cleanup failure with zero kill attempts; it now tries that exact owned
public server handle once, with a1s bound. Six ownership/failure tests pass
Node24/20, including a never-settling kill. Original server_timeout is retained
and success is never inferred from the fallback; no action replay or RPC budget
change. Two real Node22 Chromium/Firefox raw fixtures pass afterward. This limits
resource carryover after an already failed raw source run; it does not diagnose
Windows Firefox stalls or replace the independent executor watchdog.
Installed jobs smoke now preserves failed private fixture data after verified
cleanup and reports only fixed phase/state/reason/cleanup receipt fields on its
first-result assertions. No workflow/page content is added to diagnostics.
