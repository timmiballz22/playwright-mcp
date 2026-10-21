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

Initial supervised-soak instrumentation at source runtime 5c18667 (Linux x64,
Node24.19.0, two available CPUs): 100 fresh Chromium runs/400 actions completed
in 78,270ms, median730ms/p95799ms, zero active owned descendants after every run,
parent FDs23->23. The preset parent RSS criterion **failed**: 78,315,520-byte
median growth versus a 33,554,432-byte budget. Peak sampled summed owned-tree
RSS554,188,800 bytes, sampled owned CPU lower bound70,660ms. Sampling ran inside
the measured executor frontend; observer allocations contaminate the parent RSS
measurement. This is not a demonstrated product leak or a passing soak gate.
A separated observer/subject control will test that explanation with unchanged
thresholds. Browser descriptor enumeration was partly denied by kernel access
controls (32 observed process identities); only readable descriptor counts were
collected. No access controls were changed. Evidence:
evidence/supervised-soak-inprocess-rss-failed.txt and the earlier fail-closed
permission discovery evidence/supervised-soak-proc-fd-denied.txt. These are scripted
source-boundary measurements, not MCP or model-token comparisons.

Separated-observer control, same source executor/alpha browser dependency, Linux
and Node24.19.0, same 100 fresh Chromium workflows and unchanged thresholds:

| Measurement | Observed |
|---|---:|
| Completed workflows / browser actions | 100 / 400 |
| Total wall time, including instrumentation | 78,922ms |
| Median / p95 supervised run duration | 728 / 807ms |
| Subject frontend CPU | 384ms |
| Observer CPU, excluding ps helper CPU | 4,839ms |
| Sampled owned-tree CPU lower bound | 70,570ms |
| Peak sampled summed owned-tree RSS | 551,383,040 bytes |
| Peak sampled owned processes | 8 |
| Subject descriptors, baseline / final | 24 / 24 |
| Subject post-warmup median RSS growth | 1,310,720 bytes |
| RSS / descriptor growth budgets | 33,554,432 bytes / 4 |
| Active owned descendants after every run | 0 |

The subject uses normal Node heap defaults with no forced GC. The same 32MiB
RSS/4-descriptor thresholds now pass when profiler allocations are outside the
measured frontend. This supports instrumentation contamination as the cause of
the initial RSS failure; it does not erase that result or prove every workload
leak-free. scripts/soak-supervised.mjs forks scripts/soak-subject.mjs, which waits
for independent observer cleanup audits between runs. Both signal/disconnect
paths have explicit design bounds but are not yet fault-injection verified; private diagnostic roots are retained on uncertain cleanup.

Raw evidence: evidence/supervised-soak-separated-100.txt. Browser descriptor
coverage remains partial (27 process identities denied), not PASS for full tree
FD measurement. RSS sums double-count shared pages; 50ms sampling misses peaks
and short-lived CPU. The observer adds overhead and its ps helpers are not included
in the reported process CPU totals. Process audits exclude zombies; host-init
reaping is distinct from active owned processes. This is Linux source execution,
not an MCP, CLI/SKILLS, model-token, cross-OS or upgraded-driver benchmark. G12
remains IN PROGRESS. The active driver dependency must be reidentified after any
subsequent upgrade; these numbers describe the alpha engine baseline only.

Stable-driver repeat (Playwright/core1.64.1, SDK1.32.1, same Linux/Node24.19.0
observer protocol): 100 workflows/400 actions, 82,197ms total, median767ms,
p95819ms. Subject CPU390ms, observer CPU4,996ms (excluding ps helpers), sampled
owned-tree CPU lower bound72,870ms. Peak sampled summed tree RSS558,473,216 bytes,
peak sampled8 owned processes. Subject FDs24->24; post-warmup median RSS growth
1,441,792 bytes. The unchanged32MiB/four-FD thresholds pass; zero active owned
descendants were audited after every run. No forced GC or reduced routing/checks.
Browser FD coverage is partial (31 process identities denied). One run per
version is not statistical proof of performance equivalence. See
 evidence/playwright-stable-soak-100.txt for all100 records and limitations.

The upgraded SDK/driver also passed a real 1000-action stdio MCP regression
(34,315ms testcase) and actual CodexCLI0.163.0 app-server verification (34,068ms
batch): original navigation, discovery25/1, exactly1000 completed, one positive
batch tool call, four declared steps, zero model turns. Global Codex configuration
was not modified. This is not measured normal-conversation model usage or tokens.


## Interface comparison: 100 correct clicks, one Linux sample

Source runtime a3eccc0 with scripts/benchmark-local-interfaces.mjs, Linux x64,
Node22.23.3, pinned Playwright1.64.1, managed headless Chromium. Each interface
uses a fresh browser and the same static owned loopback counter. All100 clicks
must complete and the final DOM counter must equal100. Batch/CLI also assert
exact URL (103 declarative actions). No model turn is started on any path.

| Interface | MCP tool calls | Argument JSON bytes | Result JSON bytes | Other input/output | Through audited shutdown |
|---|---:|---:|---:|---|---:|
| Original MCP, default snapshot behavior |102|6,914|29,203|One necessary snapshot file read:79 bytes|54,877ms|
| Companion batch MCP |1|300|1,565|No snapshot file reads|4,765ms|
| Fork batch CLI |0|n/a|n/a|259-byte workflow file;1,960 stdout bytes|4,442ms|

Original/batch discovery responses are20,910/2,026 JSON bytes, separately from
action results. Init/discovery including the initial ownership audit takes423/
243ms. Before endpoint shutdown, measured elapsed times are54,524/4,508ms; CLI
returns its completed summary in4,273ms. Final totals include independent process
checks and endpoint shutdown, with zero active owned survivors on all paths.

Bytes are JSON-encoded tools/call parameter objects and CallToolResult objects,
not wire envelopes, token counts or billed usage. Only the initial snapshot
needed a local file read; final browser_snapshot returned usable inline content.
Intermediate click replies are counted even though the fixed loop reuses its
known button target. The CLI is this fork's batch CLI; official Playwright
CLI/SKILLS and conversational model behavior are NOT measured. Security/reporting
semantics differ: batch/CLI enforce strict origin fetch routing; original uses its
delegated default and produces per-tool reports/snapshots. This is a practical
interface sample, not an isolated protocol-overhead experiment or a throughput SLA.
CPU/RSS, medians/p95, warm reuse, multiple samples and transferred model tokens
remain unmeasured here; earlier soak resource measurements are separate. G12
remains IN PROGRESS.

Initial benchmark development runs assumed inline navigation snapshots and used
the obsolete ref input instead of the pinned target parameter. They fail before
measurements and are retained as interface-benchmark-*-diagnostic/first evidence;
they are script defects, not product regressions or timing samples. The complete
JSON sample is evidence/interface-benchmark-local.json. Reproduce with
`node scripts/benchmark-local-interfaces.mjs`; no global configuration changes.


## Preserved upstream trusted-code batching comparison

The original core tool set also exposes browser_run_code_unsafe. It already
supports batching source-authored trusted Playwright code in one call, so the
interactive102-call path above does not establish that upstream lacks batching.
A second complete Linux/Node22.23.3/Playwright1.64.1 sample adds that mode with
exact100-click DOM and URL assertions against the same owned fixture:

| Mode | MCP calls | Parameter/result JSON bytes | Through audited shutdown |
|---|---:|---|---:|
| Original interactive |102|6,914 /29,203; one79-byte snapshot read|55,116ms|
| Original trusted code |1|506 /680|5,340ms|
| Declarative batch MCP |1|300 /1,565|4,803ms|
| Fork batch CLI |0|259-byte file /1,960 stdout bytes|4,453ms|

Both batching tools use one call. The upstream trusted-code result is smaller in
this sample. The declarative batch includes bounded progress and cleanup metadata,
strict operator-origin enforcement and schema constraints; the trusted-code tool
executes arbitrary server-side JavaScript and is explicitly labeled unsafe by
upstream. The benchmark passes only static source-defined code for the owned
fixture and never accepts page/user code. Companion workflows gain no eval or
code option. All four paths confirm their counters and independently exit with
zero active owned survivors. This is one complete sample, not a confidence
interval or model-token measurement. A separate released official CLI sample follows;
SKILLS-driven model usage remains unmeasured. See
evidence/interface-benchmark-with-upstream-code.json.

A new original-tool regression executes the same100 fast clicks inside that
preserved tool on each native browser/OS. Local Chromium and Firefox both pass
(2 tests,14.6s total) including exact DOM/URL assertions and browser_close ACK.
Native coverage remains pending. It also tests whether strict Windows Firefox
failures reproduce through delegated upstream fast-loop execution, without
removing the existing failing batch tests or adding per-click delays.


## Released official Playwright CLI comparison

`@playwright/cli@0.1.22` pins Playwright/core
`1.64.0-alpha-1790635538000`, Chromium revision1247. The fork sample above uses
stable1.64.1/revision1248. These are independently released configurations,
not identical-driver measurements. The optional benchmark does not modify either
package or substitute browser executables.

On the same Linux machine and Node22.23.3, one official CLI sample completed the
same owned100-click fixture with exact DOM/URL assertions: open1,315ms, through
run-code5,639ms, through independently audited shutdown6,163ms. Three CLI commands
(open/run-code/close), zero MCP calls and zero model turns used434 JSON argument
bytes and729 stdout bytes, zero stderr bytes. These sizes exclude executable/session
arguments, wire framing and model tokens; they are not directly interchangeable
with MCP JSON byte counts. A separate Node24.19.0 sample finished in6,611ms.
Both observed zero active owned survivors. These are single samples, not an SLA
or a statistically established ranking.

Reproduce using `node scripts/benchmark-official-cli.mjs /absolute/path/to/@playwright/cli/playwright-cli.js`
after a separate normal package/browser installation. The Linux-only observer
tracks the detached runtime while its launching CLI is still alive. Each command
has a120s bound, a fresh named session uses a private workspace/cache/temp directory,
and finally closes only that session. It refuses inherited global CLI config;
no global config, profile, HOME or CODEX_HOME is changed. Failed/uncertain fixtures
are retained, not declared clean. The official runtime uses its local socket;
no hosted service is involved. This trusted run-code comparison accepts only
source-defined fixture code. It does not add code execution to companion workflows
or measure a model using official CLI/SKILLS. Evidence:
`evidence/official-cli-benchmark-node22.json` and
`evidence/official-cli-benchmark-node24.json`.
