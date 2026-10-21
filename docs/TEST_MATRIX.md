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

# Historical acceptance coverage

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
