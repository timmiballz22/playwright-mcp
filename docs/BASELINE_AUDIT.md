# Baseline audit — 2026-10-20

Baseline: `804bc7e` (clean clone of timmiballz22/playwright-mcp).
Node 24.19.0, npm 11.9.0, Linux x64. `npm ci`: 96 packages installed.
`npm run lint`: passed. `npm test -- --workers=2`: 6 passed, 2 failed
(missing Google Chrome); see evidence/baseline-upstream.txt. Batch baseline:
5 passed, 1 failed (missing managed browser), 1 skipped (explicit browser opt-in).
No baseline failure is attributed to application logic without reproduction.

## Architecture and feature map

`cli.js` decorates the bundled playwright-core MCP command; `index.js` delegates
createConnection. Keep these entrypoints and pinned Playwright versions intact.
`tests/capabilities.spec.ts` verifies 25 default names plus PDF/vision gates;
README documents 72 names, not all active by default. Tests cover navigation,
click, CommonJS and install-browser help. There is no full parity coverage yet.
`local-batch/{runner,mcp,cli,report}.mjs` is an independent companion (option A
in the mission), not a facade. Its current single synchronous tool has no jobs.

Inspected current Microsoft monorepo `89cd2a6463ea14cf36a83e629d4bfbc9988e6771`:
packages/playwright-core/src/tools/mcp/{index,browserFactory,watchdog}.ts and
backend/{tools,files,route}.ts. Tool registration filters capabilities; browser
factory already supports persistent/isolated/attached modes and ownership;
watchdog closes owned resources. These existing features should be reused via
upstream entrypoint, not duplicated. Current monorepo is newer than the pinned
alpha: no blind dependency sync is justified. Bundled pinned core is authoritative.

## Risk register

All RISK-001–014 in CODEX_ULTIMATE_MASTER_PROMPT.md remain applicable.
Confirmed P0: SDK is development-only, tarball omits companion, inherited publish
jobs target Microsoft, implicit all-port loopback, timer starts after launch,
screenshot names collide, unknown workflow properties accepted. Error messages
are scrubbed but lack precision. Jobs/profiles/retention/rate-limit handling absent.
Browser routing is not an OS sandbox; WebSocket/DNS/service worker limitations
need real negative tests. Existing README remains upstream documentation.

## Repository and platform evidence

Origin is the user's fork; main baseline above, feat/local-batch-codex-handoff
also exists. No tags found. GitHub issues disabled; open PR list empty.
Branch-protection API returns 403 (integration permission); protection unverified.
Native Windows/macOS unavailable locally; require CI, never infer PASS.
`playwright install --with-deps` failed: su authentication; browser-only download
is being attempted. No package publication is authorized.

## Reproduction

npm ci
npm run lint
npm test -- --workers=2
node --test local-batch/*.test.mjs
npx playwright install chromium firefox webkit
RUN_BROWSER_TESTS=1 node --test local-batch/*.test.mjs

Dependency tree: pinned playwright and playwright-core 1.64.0-alpha-1790635538000;
SDK ^1.25.2 (resolved in package-lock.json). No new browser engine required.
