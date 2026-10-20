# Acceptance coverage

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
| 13–16 | NOT TESTED comprehensively; lifecycle release blocker |
| 17 | Invalid actions/unknown properties/limits tested; fuzz/oversize input pending |
| 18–20 | Redirect SSRF + exact localhost origins + file/URL credentials negative tests; all encodings pending |
| 21 | Upload absent from companion; upstream behavior still requires test |
| 22–23 | WebSockets closed and service workers blocked by code; browser negative fixtures pending |
| 24 | Unique run directory implementation; 20-run screenshots/retention NOT TESTED |
| 25 | Fake secret error scrubbed; screenshots not masked; NOT COMPLETE |
| 26–27 | NOT IMPLEMENTED: status taxonomy and Retry-After handling |
| 28–33 | CSS and upstream role click tested; remaining interaction/mobile/console scenarios NOT TESTED |
| 34–36 | Ephemeral fresh state tested; persistent profile/reconnect/crash recovery NOT TESTED |
| 37–38 | 100 sequential runs, runner RSS measured; process-tree caps/FD leak proof pending |
| 39 | All 72 schemas discoverable; representative advanced behavior still NOT TESTED |
| 40 | Source uses stdio; actual OS listener enumeration NOT TESTED |
| 41 | CLI implementation present; fresh disconnected CLI operator test pending |
| 42 | MCP step results bounded to last 10; large DOM upstream snapshot behavior NOT TESTED |
| 43 | Repeated unit/integration runs passed; statistical flake audit pending |
| 44 | Publication disabled/private package; complete release-CI evidence gate pending |
| 45 | Source setup documented; clean real Codex operator validation pending |

WebKit discovery is not browser execution. Local WebKit launch FAILED on missing
libraries. No physical iOS coverage, no substitution from mobile emulation.
