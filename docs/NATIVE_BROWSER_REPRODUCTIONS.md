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

## Diagnostic scope clarification

The source controls in scripts/diagnose-raw-runner.mjs import runWorkflow and
retain its HTTP routing, service-worker/download settings and lifecycle budgets.
“Raw” means no job/supervisor orchestration; these controls alone do not isolate
a stock browser from the companion router. Original isolated MCP failures are
a separate code path. Neither set establishes an upstream root cause.
The registry latest stable remains Playwright1.64.1 on2026-10-22; no prerelease
upgrade or unverified workaround was applied. native70-playwright-registry.json.

## Stock Firefox isolation control (native follow-up pending)

`node scripts/diagnose-firefox-runner.mjs --firefox-stock` runs ten fresh headless
stock Playwright BrowserServer/connect/context/page lifetimes against the same
private static loopback fixture. `--firefox-headed-stock` selects headed mode.
Each run performs navigation,20 normal role-locator clicks (5s action limit), an
exact counter assertion and a PNG signature/16MiB check. The PNG is held only for
validation, not written as a retained artifact. This is not the20-run production
screenshot-integrity test. No companion runner/router is invoked in this mode;
there is no page-supplied code or destination input. Service-worker defaults are
stock Playwright defaults; this is provider isolation, not a policy test.

A120s operation budget and bounded5s closes apply; the existing180s parent bound
and actual factory-owned process audits remain the independent final bound. No
stored PID or protocol ID grants signal authority. Every failed run stops the
control without retry; failed artifact roots are preserved. The private
`PLAYWRIGHT_TEST_PROTOCOL_STALL=1` calibration deliberately blocks the fixture
renderer for7s on its fourth click. It must fail, not become an acceptance pass.

Native71's companion-based protocol control passed230 actions and did not
reproduce the Windows stall. Stock headed native evidence is still pending;
healthy controls cannot establish a fix, and their timing differs from acceptance.
