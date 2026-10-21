# Native browser failures requiring further diagnosis

These are local-fixture reproductions and observed native failures, not established
root causes or guaranteed failures on every run. No issue has been posted upstream.
Keep the existing assertions, deadlines and no-replay policy when investigating.
The current release remains blocked; healthy repetitions do not resolve failures.

## Windows Firefox close acknowledgement

Runtime tested: `a2a8ac7`, Playwright/Playwright Core1.64.1, Node20 wrapper CI.
[Native60 wrapper](https://github.com/timmiballz22/playwright-mcp/actions/runs/39659786624)
failed `tests/devtools.spec.ts` in the original resume session test at30s.

```sh
npm ci
npx playwright install firefox
npx playwright test tests/devtools.spec.ts --project=firefox --workers=1 -g 'original resume'
```

The fixture uses the original entrypoint with `--isolated --caps=devtools`, then
navigates to an owned local page, submits an invalid resume location, snapshots
and closes. Existing shared `original_mcp_progress` records navigation returned
in2,573ms, invalid resume returned the expected tool error in1ms, snapshot returned
in24ms, and `browser_close` remained pending27,111ms. The test deadline then closes
the MCP connection. That does not establish whether the browser process remained
alive or which internal shutdown operation stalled.

Read-only pinned-core inspection confirms isolated launch uses `browserType.launch`;
the fork guard wraps only persistent contexts. Resume registers listeners before
validating location, but invalid input never calls debugger runTo/next/resume.
That listener order is not evidence of the close failure. Do not patch it as a
claimed fix, signal a stored PID, release an uncertain profile lease, or return a
successful close from a missing acknowledgement. Linux Chromium/Firefox controls
pass; they do not reproduce or resolve the Windows failure.

Receipts: `evidence/native60-original-close-progress.json`,
`evidence/native60-resume-source-review.json`, native wrapper selected logs.

## macOS Chromium screenshot protocol failure

[Native59 wrapper](https://github.com/timmiballz22/playwright-mcp/actions/runs/39657708430)
at `4cfaf68` fails the original highlight fixture's initial plain screenshot.
`Page.captureScreenshot` returns `Unable to capture screenshot` after fonts load.
The paint/hide pixel assertions were not reached for that capture.

```sh
npm ci
npx playwright install chromium
npx playwright test tests/devtools.spec.ts --project=chromium --workers=1 -g 'original highlight'
```

The fixture polls only successful screenshot frames for the existing bounded pixel
conditions; screenshot errors fail immediately. Do not suppress failed captures or
widen the test deadline. Native60 subsequently passes this case, which does not
explain the prior failure. See `evidence/worker-ci-fiftyninth-wrapper.txt`.

## Windows Firefox uncertain pointer action

[Native58 wrapper](https://github.com/timmiballz22/playwright-mcp/actions/runs/39654189022)
at `de9c924` fails all three separate legacy Node20 Firefox workflow cases. On the
headed fresh run6, completed2/23 means only one click was confirmed, while the
fixture's post-failure counter is2. The failed click may already have taken effect.
Headless and direct-pipe modes also fail in their first fresh runs.

The Windows CI legacy step provides the exact pinned-node/environment command.
The underlying fixture is `local-batch/integration.test.mjs`; select Firefox and
ten fresh runs using its trusted test environment configuration. Preserve the
5s pointer action deadline, DOM counters, screenshot and cleanup assertions.
No forced click, suppressed failure or automatic action replay is an acceptable
resolution. Helper.js teardown warnings are observations, not an established cause.
See `evidence/worker-ci-fiftyeighth-wrapper.txt` for full fixed receipts and call logs.

## Upstream context checked during native64

Pinned Playwright 1.64.1 uses Firefox 157.0, revision r1555. Related upstream
[#43028](https://github.com/microsoft/playwright/issues/43028) describes headed
dynamic viewport resizing; a later comment reports fractional internal dimensions
with r1555. The issue is closed, and other environments did not reproduce it.
Our raw click fixture performs no dynamic resizing, and its headless/pipe cases
also fail intermittently. A shared revision does not establish a common cause.
Limited public searches found no exact current match. Versions, focus, click
semantics and deadlines stay unchanged. No external report was posted and no
third-party reproduction was executed. See native64-upstream-context.json.
