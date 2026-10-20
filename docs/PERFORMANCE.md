# Measured local performance

2026-10-20, Linux x64, Node 24.19.0, npm 11.9.0; pinned Playwright
1.64.0-alpha-1790635538000, Chromium 155 managed headless browser.

`RUN_BROWSER_TESTS=1 node --test local-batch/integration.test.mjs`:
1,000 sequential real operations (goto + 997 clicks + DOM assertion + screenshot),
37,713 ms test duration; 26.5 total operations/s. Security routing enabled.
This is one sample, not median/p95 or a comparison to upstream/CLI.

`node scripts/soak-local.mjs`: 100 fresh browser workflows, 18,041 ms,
runner RSS min 118,349,824 / max 182,501,376 bytes. RSS increased; **no leak-free
claim**. Browser process-tree RSS, file descriptors, handles and CPU not measured.
A follow-up with `node --expose-gc scripts/soak-local.mjs` samples after explicit GC;
see evidence/soak-gc.txt for actual results. This diagnostic does not replace
normal production resource measurements. Site is local, workflows sequential,
no model invocations, network caching bypassed by routing/fetch.

Missing: upstream-versus-batch-versus-CLI/SKILLS comparison, transferred tokens,
peak browser tree RSS, warm/cold distributions, mobile, artifact throughput,
network restriction overhead versus approved nonrouting workloads, repeated
reliability confidence intervals. G12 remains IN PROGRESS.

Compact repeat example (same 997 role/name clicks plus goto/assert/screenshot):
representative argument JSON is 60,952 UTF-8 bytes inline vs 209 with repeat.
This is argument serialization size, not transferred MCP frame size or measured
model tokens. A real MCP acceptance fixture uses the compact form and exact
final count. See evidence/batch-third-final.txt for execution time.

Actual Codex client sample at tested code 2321179:
Codex CLI 0.163.0 app-server -> upstream navigation + batch endpoint, 1,000
operations in one positive batch tool call (four declared steps), 33,882ms.
The counter is asserted exactly after 997 clicks; navigation and two assertions
complete the 1,000 actions. No model turn was started in this protocol test; this
is not a claim of zero model usage in normal conversational automation.

The 100-run figures above use the direct raw runner before supervised execution;
they do not measure current watchdog/worker overhead or prove current resource
stability. Actual Codex app-server at 9041497 completed one 1,000-operation batch
in 33,906ms with zero model turns. This remains a single sample with no transferred
token measurement; supervised process-tree RSS/FD/CPU soak remains open.
