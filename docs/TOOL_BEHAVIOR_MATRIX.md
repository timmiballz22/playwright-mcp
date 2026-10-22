# Original tool behavior review index

## Latest completed checkpoint — native92 at6884c4a; acceptance incomplete

[Batch39818353567](https://github.com/timmiballz22/playwright-mcp/actions/runs/39818353567)
reports1422 passes/3 failures; [original39818353471](https://github.com/timmiballz22/playwright-mcp/actions/runs/39818353471)
reports577/4. Completed summaries total1999/7, reported test skips/cancels0.
Windows main suite is unexecuted after installed-package verification fails.
Four other package steps pass. Linux20/22/24 main207/211/211 pass; Mac208/3.
Components Linux22/24/Mac146/0 each, Windows147/0; all12 real schema/version/
identity race checks pass again. All17 logs recovered:16 first reads succeed,
one Linux22 component read is empty with stream NO_ERROR from peer, then ordinary
retry succeeds. Both attempts and snapshots retained; no cancellation requested.

Windows installed original/profile/batch/jobs/controller checks pass before the
journal/guardian smoke fails. Journal reports rpc_timeout/init, last received phase
directory, journalExitConfirmedfalse. The phase is a lower bound, not a proven
blocked filesystem operation or cause. Layout probe is skipped because prior cleanup
is unconfirmed; main/Firefox comparison steps are unexecuted. Outer installation
workspace is retained. The old smoke's separate inner journal directory had an
unconditional removal path even after failed opens, and client-close errors were
swallowed. Inner directory identity, registered-client count and post-state were
not retained; do not claim that inner store was preserved or reconstruct its contents.

A concrete local fix now removes the inner store only after all acceptance checks
and client closes succeed, preserves failed/rejected/unconfirmed cases, propagates
close errors, and emits bounded workspace/client counts without data contents.
Baseline actual-worker calibration demonstrates deleted store after init timeout
and swallowed close error after two real worker exits. Fixed cases retain both
failure modes on Node22/24; positive cases close both workers and remove their
stores. Final registered-client scalar cases are verified. A fresh production
package install/check passes. This is a fixture-preservation fix, not a latency,
worker-exit, ownership, lease-repair or Windows initialization fix.

Actual Codex1k passes all3 OSs: Linux37.200s/Windows38.537s/Mac79.429s,
model turns0/owned0. Mac main raw1k times out982/120.172s; click983 interrupted,
cleanupFailureCount0. SDK jobs times out950 with resultAvailabletrue,
operatorAttentionfalse, forcedfalse/terminated/removed; result duration118.886s
within admission-inclusive deadline. Its bounded stderr has no guardian/journal
failure strings or worker-exit-unconfirmed flag; workspace audit confirms cleanup.
Sync stdio times out986, terminated/removed, client close succeeds; forced is not
recorded in its compact outcome. Mac server/pipe controls1k pass118.247s/110.323s,
owned roots0 before force/finally. Separate healthy clients/controls do not clear
these failures, native89 Windows CRASHED750 or old ownership uncertainty.

Original Linux192/0, Windows190/2, Mac191/1; Docker2/0 and Windows legacy2/1.
Windows WebKit WAV/VP9 remain ready0/network2/error0 with canPlayType probably;
this is not proof of a missing codec. Legacy headed Firefox fails fresh2 after7
actions with context_timeout. Mac Chrome advanced case fails fixture teardown with
stderr EOF unconfirmed; that is not proof of an owned browser survivor or complete
stderr. The exact last tool state is absent from the current failure receipt.
All12 independent traces,12 PDF behaviors and12 large-DOM cases pass. All four
Mac strict recorded-frame cases pass. Gray-frame gate is ineligible; fresh controls
and independent first-frame decoder probes are unexecuted. Native90 gray cause
remains unresolved. Mac modal repeats are unexecuted.

Next local fixture diagnostic emits bounded final tool progress, byte counts and
EOF/overflow state on teardown failure, including after a passed test body. No
stderr text, inputs/results, new wait or SDK timeout change. Actual healthy stdio
calibration passes; the existing1,048,577-byte producer still fails and verifies
the bounded overflow receipt. EOF-unconfirmed native branch remains pending;
negative calibration is not a production/native pass. Typecheck passes.

Shared mirror action runs on six native Linux runners across four normal job paths;
each reports changedFiles1/no remaining matched Azure URI. Fifth configured path
is opt-in functional soak, unexecuted. Components do not install browsers and are
not one of these paths. Linux main dependency installs succeed81/73/106s for
Node20/22/24; no general timing/causal guarantee or Docker image source rewrite.
All four executed main lanes retain raw checkpoints25..200 and bootstrap phases;
Windows main is unexecuted. Final API projections and full observations retained.
Five scoped factory-failure observations/four orphan receipts are deliberate-orphan/
self-exit negative controls, not unexpected survivor counts. Full Windows comparison
and rows retained without role/name/age/window filtering. Historical136/142,
native87 scoped observation and native89 worker/browser uncertainties remain open.
See [native92 summary](evidence/native92-summary.json), full logs and scoped proofs.
No release, merge, replay, default transport change or ownership-debt clearance.

## Latest completed checkpoint — native91 at74497b1; acceptance incomplete

[Batch39813834089](https://github.com/timmiballz22/playwright-mcp/actions/runs/39813834089)
reports1624 passes/4 failures; [original39813834126](https://github.com/timmiballz22/playwright-mcp/actions/runs/39813834126)
reports570/11. Completed summaries total2194/15, reported test skips/cancels0.
All five installed-package steps pass. Linux20/22/24 main207/211/211 pass;
Mac210/1 and Windows200/3. Components Linux22/24/Mac146/0 each, Windows147/0.
All12 actual second-connection schema/version/identity race cases pass natively.
This verifies the scoped write-lock fix, not a cause/fix for old initialization timeouts.
Node20 durable SQLite/jobs remain unsupported. Both workflows terminate normally;
no aggregate cancellation is requested. All17 job logs recovered:16 first reads
succeed, one Linux24 component read is partial with EOF and succeeds on ordinary
retry. Both files, exits and metadata snapshots are retained.

Actual Codex1k passes Linux36.389s/Windows38.721s, model0/owned0. Mac actual job
TIMED_OUT958, failed click959 interrupted, resultAvailabletrue/operatorAttentionfalse,
forcedfalse/terminated/removed; no guardian/journal failure strings recorded.
Mac sync stdio MCP times out969, reports terminated/removed and client close succeeds;
its compact outcome does not record forced. Other Mac raw1k and SDK jobs tests pass.
Separate Mac client controls server/pipe1k pass117.353s/105.021s; Mac main controls
pass119.184s/108.011s. All control owned roots zero before force/finally. These are
separate samples, not proof of a transport fix or clearance for native89 Windows
CRASHED750, native87 scoped observation or historical136/142 birth-record gaps.

Windows direct-pipe raw case fails first fresh run after5 actions. Locator case
stops8/19 at waitFor9, timeout/forcedfalse/terminated/removed; ambiguity cases are
unexecuted. Retry first /429 case has one GET/finished response at2.997/2.998s,
then10s workflow timeout with0 completed actions; later cases unexecuted. Private
control completes3 successful fresh runs/74 total confirmed actions including the
failed next run; last5 actions with server_timeout. Inherited/protocol-headed/
stock-headed controls have0 successful fresh runs and7/4/5 confirmed actions.
All report zero owned roots before force/finally; these audits do not turn failed
workflow/cleanup checks into successes. No role/name/age/window PID filtering.

Original Linux192/0, Windows189/3, Mac186/6; Docker2/0 and Windows legacy1/2.
Legacy server fails fresh5 after23 actions with context_timeout; direct-pipe fails
fresh1 after12 with context_timeout. Original Windows Firefox independent trace
case times out30s/connection closed:11/12 trace cases pass; all12 PDF behavior cases
pass. Windows WebKit WAV/VP9 readiness failures remain despite Media Foundation
installation success/no restart. Mac Chromium highlight capture fails; Firefox
trusted100clicks stops81, large DOM times out with masked reference error, profile
case times out90s, storage/video cases time out30s. Remaining profile/video phases
are not inferred. Core targetLocators masks every normalization error as ref-not-found,
so the large-DOM message does not establish an actually stale reference.

Mac Chrome/Chromium/WebKit strict recorded-frame cases pass this round. Firefox
video never reaches a successful decoded-frame receipt. Actual-gray gate is
ineligible; three fresh controls and independent ffmpeg diagnostics are unexecuted.
The native90 gray-frame cause remains unresolved; no speculative encoder patch.
Mac modal repeats are unexecuted. Full failure blocks and structured receipts retained.
Six scoped factory-failure observations/four orphan receipts belong to deliberate-
orphan/self-exit negative controls; they are not six unexpected ownership failures.
One Windows full legacy comparison and all observed rows/lifetimes remain retained.

All five main lanes retain raw checkpoints25 through200. Final API annotations
retain25 through175 plus all three bootstrap phases, including PowerShell. In-progress
annotation reads were empty. Do not infer unexecuted tests from that or claim200
was persisted in the API. Cancelled-main/missing-log persistence remains unverified.
Three Linux batch mirror notices each report changedFiles1 and no remaining matched
Azure URI. Their dependency installs succeed80/67/56s for Node20/22/24. File identity
is not logged, and this is not an isolated causal/performance guarantee. Original
Linux still uses separate setup and later reaches tests.

Next local follow-up shares the exact validated mirror body across all five host
Linux browser-install paths; five shell fixtures, byte comparison, YAML/Bash syntax
and actionlint pass (shellcheck/pyflakes disabled),297-file package excludes action
and evidence. Failure-only large-DOM call timings add no RPC, retry, wait or deadline
change; original Chromium/Firefox scenarios2/2 and typecheck pass locally. Failure
branch awaits native execution. Actual local Codex1k passes38.896s, model0/owned0,
with foreign-owner rejection, active cancellation and terminal cleanup. Native
follow-up remains pending. See [native91 summary](evidence/native91-summary.json),
full logs and schema-race/checkpoint/install/first-frame/control proof files.
No merge, publication, unsafe replay, default transport change or ownership-debt clearance.

## Latest completed checkpoint — native90 at58edfce; acceptance incomplete

[Batch39803246586](https://github.com/timmiballz22/playwright-mcp/actions/runs/39803246586)
reports1403 passes/6 failures; [original39803246848](https://github.com/timmiballz22/playwright-mcp/actions/runs/39803246848)
reports578/3. Completed summaries total1981/9, reported test skips/cancels0.
Node20 main/package checks were unexecuted after dependency installation cancelled
at the unchanged30m job limit. Four executed installed-package steps pass.
Linux22/24 main211/0 each, Windows202/1, Mac207/4 (full211 outcomes recovered).
Components Linux22/24/Mac143/0 each, Windows143/1. All17 job logs were nonempty
on the first ordinary read after both workflows and their jobs were terminal.

Actual Codex1k passes on Linux36.145s, Windows39.741s, Mac79.104s, model turns0
and owned roots0. These do not clear native89 Windows CRASHED750/no result,
its unconfirmed worker/browser exits, native87 scoped observation, or historical
136/142 PID counts with missing birth facts. Windows private/inherited/protocol-
headed/stock-headed controls each pass10 fresh runs/230 actions, with zero owned
roots before force/finally. Mac server/pipe1k pass118.822s/109.420s, owned0.
All three full legacy comparisons retain rows and identities without role filtering.

Mac raw1k stops982, then failed-click cleanup test is interrupted at983; SDK jobs
stops970 and sync stdio977. Both MCP receipts time out and report forcedfalse,
terminated/removed; SDK resultAvailabletrue/operatorAttentionfalse. These are
separate observations from the successful actual client. Firefox retry fragment
case completes1 with2 hits then times out; later cases unexecuted. Windows privacy
verifies1/8, reaches /403 without GET/finished receipts, then times out; request
classification was not reached. Its audit confirms cleanup. Windows component
forced schema_tables timeout is expected; the following normal reopen fails with
rpc_timeout/init, last-received stage schema_commit, exitConfirmedtrue. That stage
is a lower bound, not proof of a blocked COMMIT/fsync. The failed store is retained.

Original Linux192/0, Mac191/1, Windows190/2; Docker2/0 and Windows legacy3/0.
Mac modal repeats are unexecuted. All12 independent trace and12 PDF behavior
cases pass. Mac Chromium first browser sample is gray[128,128,128,255] at320×240,
ready4, while source PNG is red[255,0,0,255]. All three metadata-copy controls
remain gray with unchanged encoded bytes. Mac WebKit producer still passes;
Windows WebKit WAV/VP9 readiness failures remain. No producer fix is established.

All four executed main lanes emit checkpoints25 through200. Final Mac check API
annotations independently retain all eight numbers. Persistence for a cancelled
main job with unavailable logs remains unverified. The batch aggregate remained
in_progress after all13 jobs were terminal; a normal cancel request then finalized
it as failure. All job end times predate that request; no running test was cancelled
by it and no cleanup causality is inferred. Snapshots and request receipt are retained.

Correction to earlier mirror wording: a successful old rewrite step and native89
35–48s setup did not prove an actual URI switch. The published runner script uses
mirror+file:/etc/apt/apt-mirrors.txt, omitted by that step. Native90 Node20 still
fetches Azure for about28m before cancellation. Pending correction covers the
indirect mirror list with five exact-shell fixtures, preserving canonical/security
fallbacks, signing and unrelated entries. Actual runner rewrite/performance pending.

Next-source local verification: schema identity/version revalidation under the
existing write lock rejects three real connection races;41 journal/controller
regressions pass each Node22/24 and fresh installed-package checks pass. CI-only
bootstrap phase notices pass Bash syntax; PowerShell awaits native execution.
Independent ffmpeg frame-zero decoding plus five-point grids pass diagnostics on
Node20/22/24; three fresh controls preserve two prior recordings exactly. Four
actual-receipt gate cases pass. These diagnostics retain the strict original pixel
assertion and five-second shared budget; they do not explain the native gray frame.
No timeout increase, unsafe replay, lease clearance or default transport change.
See [native90 summary](evidence/native90-summary.json), full per-job logs and
corresponding schema-race, first-frame, gate and mirror proof files. No release claim.

## Latest completed checkpoint — native89 at8416021; acceptance incomplete

[Batch39795946998](https://github.com/timmiballz22/playwright-mcp/actions/runs/39795946998)
reports1385 passes/4 failures; [original39795947087](https://github.com/timmiballz22/playwright-mcp/actions/runs/39795947087)
reports582/2 including legacy and fresh modal repeats. Completed summaries total
1967/6, reported test skips/cancels0. Mac main job cancelled at30m limit, with an
empty log on first read and ordinary retry; no main outcomes or cleanup clearance.
All five installed-package steps succeed (Mac via REST only; Node20 SQLite/jobs/
guardian unsupported). Linux20/22/24 main207/211/211 pass. Linux dependency installs
finish48/35/45s after canonical HTTPS mirror setup; earlier Azure25–30m fetch stalls
remain evidence, not an isolated causal/performance guarantee. Windows main199/4.
Components139/139 each Linux22/24 and Mac, Windows140/140 pass.

Original Linux192/0, Mac192/0, Windows190/2; Docker2/0, Windows legacy3/0, fresh
Mac modal3/0. All12 independent trace cases pass; six Chromium PDFs and six explicit
Firefox/WebKit rejection/no-file cases pass. Mac WebKit actual producer passes
strict decoded-red320×240/six-click check again under prepared core3eb; successful
exact pixel not logged. Windows WebKit PCM and VP9 readiness remain the original
failures despite correct ranges. Healthy prompt/screenshot/legacy samples do not
explain earlier failures or clear old ownership debt. Exact sources and full logs
are in native89-original-checkpoint-proof.json and wrapper logs.

Windows actual Codex job recovers CRASHED with750 recorded actions (lower bound),
no result, operatorAttentionRequiredtrue. Journal failure rpc_timeout/progress;
guardian hint poll/journal_unavailable/read, guardian exit1/none. SQLite-worker and
browser cleanup are not confirmed by that receipt. No replay, lease clearance or
owned0 claim. Separate zero-browser diagnostic verifies all three inherited pairs
and first codex_core pair; second core pair verifies1/2, later pair unexecuted.
Its metric includes audit/connect/discovery/list checks, so this is not proof of
which connection/init phase failed. No typed startup/journal code was recorded.
Mac actual times out943, forcedfalse/terminated/removed; Linux1k35.408s model0/owned0
passes. Mac pipe control1k93.130s passes, server973/120.046s times out, both report
zero owned roots before force/finally. Product transport/default/deadlines unchanged.

Windows deadline case fails browser_launch_not_observed: completed0, duration9.579s,
forcedtrue/terminated/removed. It does not prove an observed browser survived; the
intended live-browser cleanup proof was not reached. Raw headed fresh4 completes
23/23 but cleanup fails. Locator positive stops14/19 at waitFor15; ambiguity cases
unexecuted. Retry/429 has two GETs/finished responses but0 completed actions, then
timeout; later retry cases unexecuted. Private/inherited/protocol-headed controls
all10fresh/230 pass; stock-headed3 successful fresh/92 actions then server_timeout.
Control owned-root audits zero before force/finally do not clear the actual-client
crash, native87 scoped observation or historical136/142 PID counts. Full legacy
rows and identities remain retained without role/name/age/window filtering.

All17 nonoptional job logs attempted,16 nonempty first-read successes; Mac empty
read and retry retained. No manual cancellation requested for native89. Mac final
completion timestamp15:03:26 predates its late reported terminal status. Source
metadata snapshots retain nonmonotonic/stale queued states; completed logs and
final step outcomes govern counts. Collectors sequential/max3 reads; no artifact
download or authentication workaround. Mac main results stay unobserved.

Local follow-ups excluded from native89 preserve three more multi-journal fixture
stores after acceptance/close failure (positive3/3 each22/24; controlled real close
faults retain3 stores after six actual exits). A measured redundant schema-header
assignment is now conditional inside the same original transaction: baseline warm
open WAL37,112→41,232 bytes; Node22/24 fixed opens preserve exact37,112 bytes. All38
journal/contention/controller regressions each22/24 pass. Real old-style SQLite
write adds4,120 bytes and fails the new byte-equality regression; both actual journal
workers exit and failed store remains. This is not a Windows timeout-cause claim.
Fresh297-file scripts-disabled production installation/all real endpoint/journal/
guardian checks pass. FULL sync, identity/schema checks, checkpoint, busy/RPC limits
unchanged. New bounded CI notices expose only receipt numbers every25 tests (cap16);
parser5/5 each LTS and actual-log replays preserve summary counts. Future cancelled-job
notice persistence remains unverified. Next native source is pending; no release claim.
Evidence: native89-summary.json, warm-journal/negative/checkpoint proofs and full logs.


## Latest completed checkpoint — native88 at702b616; acceptance incomplete

[Batch39788239513](https://github.com/timmiballz22/playwright-mcp/actions/runs/39788239513)
reports1167 passes/7 failures; [original39788239509](https://github.com/timmiballz22/playwright-mcp/actions/runs/39788239509)
reports550/7 including legacy. Completed summaries total1717/14; reported test
skips/cancels0. Two CI jobs cancelled at unchanged30m budgets: Linux22 during
Ubuntu dependency fetching (package/main unexecuted), Mac during main suite.
Mac main log is empty on first read and ordinary retry; its test outcomes and
cleanup remain unobserved. No partial Mac counts are invented. Node20 main207/0
completes. Linux24 main210/1, Windows198/5. Components138/0 each Linux22/24 and
Mac, Windows138/1. Four installed-package step successes; Mac success is REST
metadata because its job log is unavailable; Node20 SQLite/jobs/guardian unsupported.

Actual Mac WebKit producer now passes the unchanged320×240 strict decoded-red
threshold and six-click recording case with prepared core3eb. Exact successful
pixel is not logged. Eleven of twelve native cases pass for each PCM and WebM;
Windows WebKit is the failure in each. Windows WAV remains ready0/network2/error0/durationnull
after one206; WebM ready0/network3/error4 after two206. Correct ranges alone
did not repair Windows media. Docker prepared-hash and two endpoint cases pass.
Original Linux184/0, Windows181/3, Mac183/1; legacy Windows0/3. Windows first
prompt click times out before uploads. Mac Firefox trusted100click case stops86;
its screenshot/advanced case passes this sample, not an explanation of older failures.

Linux24 WebKit alias test fails the explicitly approved control: timeout0/4,
forcedfalse, terminated/removed. Its unapproved-port phase is unexecuted; this
is not evidence of an allowlist escape. Windows privacy stops at/401, verified0/8,
with one request/finished response and typed401 fact retained before timeout;
scoped audit confirms zero. Raw direct-pipe fresh8 stops9/23 at click10. Locator
case reports19/19 but timeout/forcedtrue; later ambiguity checks unexecuted.
Retry/429 reports one completed action/two GETs and finished responses, then
timeout/forcedtrue. Popup quota case stops2/10 at waitFor3; quota assertion is
not reached. These are incomplete feature checks, not proof of new policy errors.

Windows queue-expiry/lease component fails journal_unavailable at2047ms; command,
init phase and worker-exit facts were not projected in this log. Its fixture
silently discarded close rejections and removed storage even on acceptance
failure. Prospective QA correction preserves failed/uncertain storage and throws
cleanup failures with original cause. Bounded non-getter component annotations
now retain allowlisted journal command/phase/exit facts; no RPC/runtime change.
Reporter7/7 each Node20/22/24; queue case1/1 each22/24 locally. Historical unknown
worker state is not reconstructed or cleared by these changes.

Actual Codex1k passes Linux35.710s/Windows38.162s with model0/owned0; Mac times
out951, forcedfalse/terminated/removed. Mac direct-pipe control1k89.249s passes;
server stops999 at120.055s. Windows private/inherited/protocol-headed controls
all10fresh/230 pass; stock-headed8 successful fresh/191 actions then context
timeout. Controls report zero owned roots before force/finally; old samples stay.

All17 nonoptional job log reads attempted;16 nonempty recovered. Lint invalid
ZIP/zero-byte first read and successful ordinary retry retained; Mac empty reads
both retained. Collectors ran sequentially with max3 reads; no artifact download
or authentication workaround. Normal cancellation requested after stale-reported
Mac activity exceeded42m; final job completion timestamp predates that request.
Both jobs have30m timeout annotations. No claim that the request caused termination,
proved cleanup or changed a limit. Historical136/142 PID counts and other ownership
debt stay open; full current legacy comparison rows retained without role filters.

Local follow-ups excluded from native88: independent trace/PDF4/4 each Node20/22/24,
verified16-file Docker context93,192B, and Linux batch-only canonical HTTPS Ubuntu
archive substitution after two measured25–30m Azure fetch stalls. Apt signing,
package requirements and job/action/RPC limits unchanged; native mirror effect
pending. Three actual sed transformation fixtures preserve unrelated repositories
and signing configuration. Next candidate requires native validation. Evidence:
native88-summary.json, native88-original-checkpoint-proof.json and complete logs.


Local follow-up excluded from native88 adds independent trace/PDF behavior cases
without changing the combined advanced case. Chromium/Firefox4/4 each Node20/22/24
pass; tracing checks an acknowledged click in real NDJSON and inactive-stop errors,
PDF checks a Chromium document and explicit Firefox rejection/no file. Native and
WebKit verification pending; no rendered PDF-content claim. See
evidence/native88-independent-artifacts-proof.json.

## Latest completed checkpoint — native87 at b279f0d; acceptance incomplete

[Batch39778440595](https://github.com/timmiballz22/playwright-mcp/actions/runs/39778440595)
reports1362 passes/3 failures; [original39778440886](https://github.com/timmiballz22/playwright-mcp/actions/runs/39778440886)
reports551/6 including legacy and Docker. Completed summaries total1913/9,
reported test skips/cancels0. Node20 main is incomplete:94 individual passing
receipts before the unchanged30-minute job limit, excluded from those totals.
Browser installation consumed25m42s; installed-package verification then passed.
All five297-file package checks completed; Node20 SQLite/jobs/guardian unsupported.
All17 nonoptional job logs were retrieved first-read successfully, using at most
three concurrent reads. No artifact download or authentication workaround.

Components pass132 each Linux22/24 and Mac22,133 Windows. Linux main211 each;
Windows201/2; Mac210/1. Actual Codex1k passes Linux35.917s and Windows38.196s
with model0/owned0. Mac actual client times out after895 confirmed actions;
Mac raw main times out after992; SDK and synchronous1k pass. Separate Mac pipe
controls pass, but actual-client server control stops988 at120.522s. Healthy
samples do not establish reliable Mac1k completion. Control owned-root audits
report zero before force/finally; they do not clear unrelated ownership debt.

Windows supervised Firefox20 fails a scoped audit with one observed PID. Action
success assertions follow that audit and were not reached. The full private audit
file was not recovered; legacy-only stdout logging omitted this observation's
rows/births. The observation remains unresolved. A prospective fixture change
retains full observed IDs and existing same-snapshot rows/lifetime identities
before the unchanged assertion, plus bounded execution metadata on audit failure.
Firefox locator positive stops11/19 at step12; later ambiguity cases unexecuted.
Private/protocol-headed/stock-headed diagnostic controls fail after9/2/9 successful
fresh runs respectively; inherited10/230 passes. Independent legacy headed fresh9
stops5/23 at step6. No replay, transport default, deadline or ownership filter changes.

Original Linux184/0, Windows181/3, Mac182/2, Docker2/0 with pinned encoder hash.
Windows failures include WebKit PCM/VP9 readiness and slider case whole-test30s
expiry while browser_evaluate remained pending; slider bound negatives were not
fully reached. Mac Chromium fails source PNG protocol capture before recording.
Mac WebKit decodes red as248/37/0/255. A native metadata-only primaries709 copy
corrects it to255/2/0/255 with identical encoded stream bytes. Transfer additions
produce the same sampled correction. Optional Mac ffmpeg setup succeeded; only
that diagnostic setup is continue-on-error. Strict original assertions remain.

The next candidate integrates the minimal encoder -color_primaries bt709 addition
alongside the existing smpte170m matrix. Prepared core SHA256 is
3eb68a089871529d6dccd723546bc87e20299047e140d382dc5fe380b1350192.
Local actual original PCM/video4/4 each Node20/22/24 and fresh297-file production
installation with scripts disabled pass. Four-color/two-size controls pass8/8;
these do not establish native producer efficacy. Correct single byte-range/HEAD
owned-media responses and six HTTP cases are included; Windows effect is pending.
Latest scoped-retention QA passes actual Chromium/Firefox20 and focused fixtures
on all three Nodes. No product process-ownership algorithm was changed.

Historical legacy PID counts136/142, missing births/rows, prior unconfirmed exits,
security/resource/operator gates remain open. No process role/name/age/window
filter, extra signal authority or lease/debt clearance is introduced. Native88
verification is pending. Full receipts: evidence/native87-summary.json and
native87-*-job-*.log; local phases: native88-combined-* and native87-*-proof.json.


Pinned stable1.64.1 extended Chromium discovery defines72 tools. This index maps
source fixture touchpoints; a source call is not itself a PASS or a coverage
percentage. Consult execution evidence for the exact commit, engine and OS.
Latest completed native82 atbbf4764 reports normal original156 per platform,
Docker2 and Mac modal3 passes, with three legacy Windows failures. These results
do not include subsequent media/frame tests. Native83 at e95f029 is pending.
New local frame regression fails Firefox color fidelity; diagnostics identify
missing VP9 color matrix metadata, not a shipped fix. See native83-video-proof.json.

Archived native76 checkpoint:

Latest completed native76 (9591621) reports462 original passes/two legacy Windows
failures. Normal Linux/Windows/Mac suites152 each, Docker2 and Mac modal3 pass;
legacy Windows1/2 fails raw input (including an unacknowledged delivered click).
All12 profile and12 routing-negative cases pass;72 schemas remain checked.
This healthy Mac capture sample does not causally fix older failures. Parameter/
negative/interactive acceptance remains incomplete. Companion API cancellation
proof does not change the original endpoint's expert trust model.

Interactive annotation/debugger-resume flows remain open. Other rows still need
full negative/parameter/native review; export overwrite
permissions/Windows ACLs, route alternatives and video frame content are examples.
The original trusted-code/evaluate tools retain their documented expert trust.
Companion workflows expose no code/file/network-policy injection fields.

| Tool | Fixture source touchpoints | Review state |
|---|---|---|
| browser_close | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [advanced.spec.ts](../tests/advanced.spec.ts), [devtools.spec.ts](../tests/devtools.spec.ts), [held-input.spec.ts](../tests/held-input.spec.ts), [input-parity.spec.ts](../tests/input-parity.spec.ts), [interactions.spec.ts](../tests/interactions.spec.ts), [large-dom.spec.ts](../tests/large-dom.spec.ts), [network-console.spec.ts](../tests/network-console.spec.ts), [network-routing.spec.ts](../tests/network-routing.spec.ts), [popup.spec.ts](../tests/popup.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts), [storage.spec.ts](../tests/storage.spec.ts), [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts), [media.spec.ts](../tests/media.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_resize | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_get_config | [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_console_messages | [network-console.spec.ts](../tests/network-console.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_cookie_list | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_cookie_get | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_cookie_set | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_cookie_delete | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_cookie_clear | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_resume | [devtools.spec.ts](../tests/devtools.spec.ts) | Malformed-location negative passes native2d8fe7f host suites; successful interactive lifecycle pending |
| browser_highlight | [devtools.spec.ts](../tests/devtools.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_hide_highlight | [devtools.spec.ts](../tests/devtools.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_annotate | No automated behavior fixture | Interactive acceptance pending |
| browser_handle_dialog | [interactions.spec.ts](../tests/interactions.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_emulate_media | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_evaluate | [input-parity.spec.ts](../tests/input-parity.spec.ts), [network-routing.spec.ts](../tests/network-routing.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_file_upload | [interactions.spec.ts](../tests/interactions.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_drop | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_find | [large-dom.spec.ts](../tests/large-dom.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_fill_form | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_press_key | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [held-input.spec.ts](../tests/held-input.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_type | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_mouse_move_xy | [held-input.spec.ts](../tests/held-input.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_mouse_click_xy | [devtools.spec.ts](../tests/devtools.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_mouse_drag_xy | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_mouse_down | [held-input.spec.ts](../tests/held-input.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_mouse_up | [held-input.spec.ts](../tests/held-input.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_mouse_wheel | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_navigate | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [advanced.spec.ts](../tests/advanced.spec.ts), [click.spec.ts](../tests/click.spec.ts), [core.spec.ts](../tests/core.spec.ts), [devtools.spec.ts](../tests/devtools.spec.ts), [held-input.spec.ts](../tests/held-input.spec.ts), [input-parity.spec.ts](../tests/input-parity.spec.ts), [interactions.spec.ts](../tests/interactions.spec.ts), [large-dom.spec.ts](../tests/large-dom.spec.ts), [network-console.spec.ts](../tests/network-console.spec.ts), [network-routing.spec.ts](../tests/network-routing.spec.ts), [popup.spec.ts](../tests/popup.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts), [storage.spec.ts](../tests/storage.spec.ts), [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_navigate_back | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_network_requests | [network-console.spec.ts](../tests/network-console.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_network_request | [network-console.spec.ts](../tests/network-console.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_network_state_set | [network-routing.spec.ts](../tests/network-routing.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_pdf_save | [advanced.spec.ts](../tests/advanced.spec.ts), [artifact-features.spec.ts](../tests/artifact-features.spec.ts) | native89 six Chromium documents and six explicit Firefox/WebKit rejection/no-file cases pass; no rendered-content claim |
| browser_start_recording | [devtools.spec.ts](../tests/devtools.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_stop_recording | [devtools.spec.ts](../tests/devtools.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_route | [network-routing.spec.ts](../tests/network-routing.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_route_list | [network-routing.spec.ts](../tests/network-routing.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_unroute | [network-routing.spec.ts](../tests/network-routing.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_run_code_unsafe | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [advanced.spec.ts](../tests/advanced.spec.ts), [media.spec.ts](../tests/media.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_take_screenshot | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [advanced.spec.ts](../tests/advanced.spec.ts), [devtools.spec.ts](../tests/devtools.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_snapshot | [accessibility-mobile.spec.ts](../tests/accessibility-mobile.spec.ts), [devtools.spec.ts](../tests/devtools.spec.ts), [held-input.spec.ts](../tests/held-input.spec.ts), [input-parity.spec.ts](../tests/input-parity.spec.ts), [interactions.spec.ts](../tests/interactions.spec.ts), [large-dom.spec.ts](../tests/large-dom.spec.ts), [popup.spec.ts](../tests/popup.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_click | [advanced.spec.ts](../tests/advanced.spec.ts), [click.spec.ts](../tests/click.spec.ts), [held-input.spec.ts](../tests/held-input.spec.ts), [interactions.spec.ts](../tests/interactions.spec.ts), [large-dom.spec.ts](../tests/large-dom.spec.ts), [popup.spec.ts](../tests/popup.spec.ts), [media.spec.ts](../tests/media.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_drag | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_hover | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_select_option | [input-parity.spec.ts](../tests/input-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_generate_locator | [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_storage_state | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_set_storage_state | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_tabs | [advanced.spec.ts](../tests/advanced.spec.ts), [popup.spec.ts](../tests/popup.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_start_tracing | [advanced.spec.ts](../tests/advanced.spec.ts), [artifact-features.spec.ts](../tests/artifact-features.spec.ts) | native89 independent12/12 across3 OSs ×4 engines; real click trace and inactive-stop checks pass; other variants pending |
| browser_stop_tracing | [advanced.spec.ts](../tests/advanced.spec.ts), [artifact-features.spec.ts](../tests/artifact-features.spec.ts) | native89 independent12/12 across3 OSs ×4 engines; real click trace and inactive-stop checks pass; other variants pending |
| browser_verify_element_visible | [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_verify_text_visible | [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_verify_list_visible | [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_verify_value | [testing-capabilities.spec.ts](../tests/testing-capabilities.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_start_video | [advanced.spec.ts](../tests/advanced.spec.ts), [video-playback.spec.ts](../tests/video-playback.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_stop_video | [advanced.spec.ts](../tests/advanced.spec.ts), [video-playback.spec.ts](../tests/video-playback.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_video_chapter | [advanced.spec.ts](../tests/advanced.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_video_show_actions | [advanced.spec.ts](../tests/advanced.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_video_hide_actions | [advanced.spec.ts](../tests/advanced.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_wait_for | [input-parity.spec.ts](../tests/input-parity.spec.ts), [network-console.spec.ts](../tests/network-console.spec.ts), [media.spec.ts](../tests/media.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_localstorage_list | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_localstorage_get | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_localstorage_set | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_localstorage_delete | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_localstorage_clear | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_sessionstorage_list | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_sessionstorage_get | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_sessionstorage_set | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_sessionstorage_delete | [storage.spec.ts](../tests/storage.spec.ts) | Source coverage; native/variant evidence must be checked |
| browser_sessionstorage_clear | [storage.spec.ts](../tests/storage.spec.ts), [profile-parity.spec.ts](../tests/profile-parity.spec.ts) | Source coverage; native/variant evidence must be checked |


Slider fixture: local Chromium/Firefox each verify value7 and its real input event,
then invalid text returns a tool error after HTML range sanitization changes the
value to5. This is non-atomic original behavior, not a safe-retry signal. Pinned
core sets input.value before comparing the sanitized value and throwing Malformed
value. No upstream implementation is changed. Initial incorrect state-preservation
expectation failed2/2; corrected contract passes2/2. Native WebKit/host evidence
remains pending. See original-slider-nonatomic-before.txt/original-slider-local.txt.

Malformed browser_resume source locations return an explicit error and preserve
a usable session: local Chromium/Firefox2/2. This negative call does not prove
step/resume/breakpoint behavior or close the interactive acceptance gate.
Evidence: original-resume-negative-local.txt.

Native2d8fe7f original suites pass144/144 each on Linux, macOS Intel and Windows,
including slider valid/event/invalid partial-mutation behavior and malformed
resume-location rejection with a usable session afterward. The companion/native
Codex attempt has two client failures and an unreported cancelled macOS batch job; this is scoped original-tool evidence,
not a full green matrix or successful interactive debugger/annotation proof.


## Interactive annotation acceptance: NOT TESTED

Pinned playwright-core1.64.1 implements browser_annotate under the devtools
capability. Source review (evidence/annotation-source-review.json, bundle SHA256
included) shows it starts a detached dashboard process, then an annotation client,
and waits for human input. The abort listener kills that client; this review does
not establish dashboard shutdown or a successful screenshot/ARIA/annotation result.
No annotation call was made in this headless audit. The tool is preserved through
upstream delegation and schema discovery; its interactive acceptance remains open.

Operator procedure on a supported graphical desktop:

1. Launch this fork's original stdio endpoint with --caps=devtools and a dedicated
   isolated session. Navigate to a static page owned by the operator.
2. Invoke browser_annotate, draw a box over a known visible fixture element, add
   a fixed test label and submit. Verify the returned annotated image, matching
   ARIA element and annotation coordinates/label. Record exact engine/OS/SHA.
3. Repeat with explicit cancellation and confirm later browser_snapshot remains
   usable, without treating cancellation as a submitted annotation.
4. Close the browser/client and independently inspect the captured launcher and
   dashboard process identities. Record any surviving owned dashboard rather
   than declaring cleanup based solely on the annotation client's exit.

This procedure is not an executed PASS. The companion batch/jobs endpoints do not
expose annotation or desktop dashboard startup. The default original core tool set
omits the devtools capability; optional tool invocation retains upstream behavior.

Local post543c14f slider boundary/step fixture passes Chromium and Firefox via
actual MCP: exact min/max values succeed; below/above bounds and step mismatch
return errors after range sanitization changes the DOM, before input events.
A later valid value emits one event. This does not make failed fills atomic or
replay-safe. See original-slider-bounds-local.txt. Native68 at4f50caa verifies all12 variants
across Chrome/Chromium/Firefox/WebKit on Linux/macOS/Windows; the separate
Windows named-tab case fails, so whole original acceptance remains failed.

Latest slider bounds/step contract: tests/input-parity.spec.ts now checks lower/upper
clamping and step sanitization, including mutation before tool error and no replay.
All12 executions (four engine projects on three hosts) pass in native68 and native70.
This closes that specific parameter gap; interactive annotation/resume and the
remaining per-tool negatives stay open. See worker-ci-seventieth-wrapper evidence.

Uncommitted follow-up after native71 source6847985: malformed route headers
(missing colon and missing name) each return an error while preserving the prior
route list. Removing an unknown pattern removes zero routes. A real fetch still
returns exactly the existing202/mock body with zero server hits. Local Chromium
and Firefox pass2/2 with final exact assertions; the broader pre-refinement
routing run passes4/4. Lint passes. Native/WebKit evidence pending; no upstream
implementation or security policy changed. Evidence: original-route-negative-*.

Native72 closes the scoped routing-negative verification above: all12 executions
pass on four engine projects across three OSs. Other route parameters and the
remaining per-tool negative/operator gaps stay open. See native72-route-negative-tests.json.

Pending profile contract extension reuses browser_cookie_clear,
browser_localstorage_clear and browser_sessionstorage_clear in an opt-in profile,
then restarts it and verifies a sibling profile's persisted values remain intact.
Local Chromium/Firefox2/2 pass within the unchanged90s test limit; other projects/
native evidence is pending. This covers logical state for the fixture origin,
not full filesystem profile erasure or stale ownership recovery.

Local original dynamic DOM acceptance now covers nested open shadow snapshot refs
and Unicode activation, plus a400-logical/20-rendered-row fixture with actual
wheel materialization and stale-ref no-duplicate check. Chromium/Firefox4 each
Node20/22/24 pass; source/runtime defaults remain intact. This does not cover
closed roots, asynchronous infinite loading or native/WebKit variants. Initial
fixture quoting/tool-name/charset failures are retained in native84-dynamic-proof.json.
