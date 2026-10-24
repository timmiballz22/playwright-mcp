from pathlib import Path
r=Path('/workspace/playwright-mcp/docs')
text='''## Latest completed checkpoint — native94 at3a5b901; acceptance incomplete

[Batch39833354256](https://github.com/timmiballz22/playwright-mcp/actions/runs/39833354256)
reports1,621 passes/7 failures; [original39833354270](https://github.com/timmiballz22/playwright-mcp/actions/runs/39833354270)
reports599/9. Completed summaries total2,220/16, reported test skips/cancels0.
Both workflows finish normally. All17 logs resolved;16 first reads succeed, one
Mac original empty-error read succeeds on ordinary retry. Both attempts retained.
All five installed-package steps pass, including both parent-death variants and
new initial observations. This is a new positive sample, not repair or clearance
of native92/93 initialization, exit or failed-store uncertainties.

Linux20/22/24 main207/211/211 pass; Mac206/5 and Windows201/2. Components
Linux22/24/Mac146/0 each, Windows147/0; all12 real concurrent schema races pass.
Node20 durable SQLite/jobs remain unsupported. Actual Codex1k passes
Linux36.665s/Windows38.523s/Mac86.827s, model turns0 and owned roots0.
Mac raw1k stops968/120.046s; SDK job and synchronous MCP tests also fail. A Firefox
allowed-origin positive control times out before any completed action (not an
origin-policy escape); frozen-page test reports cleanup_failed instead of timeout.
Separate Mac server control times out966/120.044s, direct-pipe1k passes101.248s.
No timeout increase, transport-default change or replay is made.

Windows HTTP Firefox fails its first401 summary (timeout, HTTP401 recorded,
completed0) and teardown observes one scoped PID with the same captured birth.
Full original PID lists, birth rows, root rows and comparison are retained; this
is not a negative-control observation. Later privacy comparisons have scoped0
and127 legacy-only candidates, all rows retained, audit helper matched. These
observations authorize no signals, role filtering or historical debt clearance.
Firefox POST-cancellation test fails cleanup_failed/browser_ownership_unconfirmed
before any request or committed step. It provides no successful POST witness.
The six component scoped observations/four orphan receipts remain deliberate
negative controls and are distinct from the real HTTP teardown failure.

Original main Linux200/0, Mac199/1, Windows197/3; each includes eight additive
stock references beyond the original192 cases. All12 stock single-PNG captures
pass; stock PCM11/12 pass. Windows stock WebKit PCM remains ready0/error0 after
both preload and a real user play click (play pending). Original WebKit PCM and
VP9 fail too. This narrows the sample to the stock path without proving an OS or
codec cause. Legacy Windows Firefox server/headed fail at10/23 and3/23 actions;
direct-pipe completes23/23 but fails context_timeout cleanup. Docker2/0.

Mac Chromium source PNG is red at100,100 and319,239, but browser frame zero and
independent ffmpeg frame zero both contain gray128 at those positions. Three
metadata-copy controls retain encoded bytes and remain gray. Encoded content is
therefore implicated; actual first input JPEG dimensions were not captured.
Three fresh isolated controls are1/2: one pass, one source-screenshot capture
error, one MCP AbortError. Two independent fresh frame-zero probes are red; the
original failure remains authoritative. No first-frame skip, seek or warmup.

Next test-only observer records bounded JPEG SOF dimensions for the first eight
actual ffmpeg input frames, forwarding original writes/arguments/callbacks and
return values. Local Chromium/Firefox pass; native geometry evidence is pending.
No encoder change or causal fix is claimed. Release G18 remains BLOCKED.
Full logs, snapshots and receipts: [native94 summary](evidence/native94-summary.json),
[process comparisons](evidence/native94-full-factory-observations.json),
[stock/frame references](evidence/native94-stock-and-frame-receipts.json).
Opt-in functional soak and interactive operator walkthrough remain unexecuted.

'''
for name in ['CODEX_EXECUTION_REPORT.md','CODEX_EXECUTION_LEDGER.md','RELEASE_BLOCKERS.md','SCENARIO_MATRIX.md','TEST_MATRIX.md','TOOL_BEHAVIOR_MATRIX.md']:
 p=r/name;s=p.read_text();i=s.index('## Latest completed checkpoint');s=s[:i]+text+s[i:].replace('## Latest completed checkpoint','## Previous completed checkpoint',1);p.write_text(s)
p=r/'CODEX_EXECUTION_LEDGER.md';s=p.read_text()
rows={
'G00 BASELINE':('IN PROGRESS','native94 completed summaries2220/16, all17 logs resolved','Full green matrix remains absent'),
'G01 INSTALL':('PASS','native94 all five installed-package checks pass, both parent-death variants included','Prior failed/unconfirmed exit samples remain unresolved; no retroactive repair'),
'G02 MCP':('FAILED','native94 actual1k passes all3 OSs; Mac SDK/sync and raw1k fail','No clearance of native89 Windows750 or old birth gaps'),
'G03 FEATURE PARITY':('FAILED','native94 main original Linux200/0 Mac199/1 Windows197/3 incl8 additive references each','Mac encoded-gray and Windows media unresolved'),
'G04 BATCH':('FAILED','native94 Linux207/211/211 pass, Mac206/5, Windows201/2','Mac deadline/cleanup and Windows HTTP ownership failures'),
'G05 RETRIES':('FAILED','native94 Windows Firefox POST-cancellation cleanup_failed before requests','No unsafe replay or inferred committed POST'),
'G06 JOBS':('FAILED','native94 components and12 races pass; Mac SDK job times out','Healthy package does not resolve historical worker-exit uncertainty'),
'G10 CROSS-BROWSER':('FAILED','native94 stock PCM11/12; Windows WebKit stock and MCP fail; Mac encodedgray','All12 stock PNG pass, no codec/capture reliability guarantee'),
'G11 CROSS-OS':('FAILED','native94 all package checks pass, Mac5/Windows2 main failures remain','Windows scoped HTTP survivor retained in full'),
'G14 ADVANCED':('FAILED','native94 Mac video frame-zero gray independently confirmed','Bounded passive input geometry observer native pending'),
'G17 AUDIT EVIDENCE':('IN PROGRESS','native94 full17 logs after one normal retry, scoped survivor and127 legacy rows retained','No role/age filtering or historical ownership clearance'),
'G18 CLEAN MERGE':('BLOCKED','Draft PR2; native94 failed; geometry observer locally passing','Critical gates before merge/release')}
for key,(state,evidence,nextstep) in rows.items():
 s='\n'.join(f'| {key} | {state} | {evidence} | {nextstep} |' if l.startswith('| '+key+' |') else l for l in s.splitlines())+'\n'
p.write_text(s)
