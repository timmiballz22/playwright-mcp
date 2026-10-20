# Local Playwright batch tool (fork-only addition)

This fork preserves the original Microsoft Playwright MCP implementation. The
`local-batch/` companion is separate: it runs an entire browser workflow
locally without a cloud browser service, hosting, or one agent tool call per click.

**Not unlimited ChatGPT:** Local automation removes per-click *browser-provider*
credits, but cannot remove model usage allowances, machine limits, website
rate limits, or authorization requirements.

## Setup (Node.js 20+ recommended)

```bash
git clone https://github.com/timmiballz22/playwright-mcp.git
cd playwright-mcp
npm ci
npx playwright install chromium
node --test local-batch/runner.test.mjs
RUN_BROWSER_TESTS=1 node --test local-batch/integration.test.mjs
```

On Windows PowerShell use
`$env:RUN_BROWSER_TESTS="1"; node --test local-batch/integration.test.mjs`.
Playwright MCP's existing configuration and `node cli.js` remain intact.
Install Firefox and WebKit as desired via `npx playwright install firefox webkit`.

## Codex client: two local MCP processes

Microsoft's upstream, full-featured Playwright MCP server:

```bash
codex mcp add playwright npx "@playwright/mcp@latest"
```

For this local checkout, point a second MCP entry at
`node /ABSOLUTE/PATH/playwright-mcp/local-batch/mcp.mjs`.
Example `~/.codex/config.toml`:

```toml
[mcp_servers.playwright]
command = "node"
args = ["/ABSOLUTE/PATH/playwright-mcp/cli.js"]

[mcp_servers.local_playwright_batch]
command = "node"
args = ["/ABSOLUTE/PATH/playwright-mcp/local-batch/mcp.mjs"]
# env.PLAYWRIGHT_BATCH_ALLOWED_ORIGINS = "https://example.com"
```

No HTTP listener is opened by the sidecar. Both processes use standard I/O.
The SDK is a runtime dependency. Source installs and local tarballs support
production dependency installs. This private fork cannot be published to npm.
The upstream npm command above installs Microsoft's package, not this fork.

## Batch CLI

A JSON file specifies a bounded ordered workflow:

```json
{
  "browser": "chromium",
  "iterations": 1,
  "timeoutMs": 120000,
  "steps": [
    { "type": "goto", "url": "http://127.0.0.1:3000/" },
    { "type": "click", "selector": "button#start" },
    { "type": "fill", "selector": "input#name", "value": "Example" },
    { "type": "assertText", "selector": "#status", "contains": "Ready" },
    { "type": "screenshot" }
  ]
}
```

Run against your own local site:

```bash
node local-batch/cli.mjs --workflow ./my-workflow.json --allow-origin http://127.0.0.1:3000
```

To opt in to a public origin:

```bash
node local-batch/cli.mjs --workflow ./my-workflow.json --allow-origin https://example.com
```

Additional flags: `--artifacts /SAFE/OUTPUT/DIR`. The local MCP sidecar
accepts operator configuration via environment variables
`PLAYWRIGHT_BATCH_ALLOWED_ORIGINS` (comma-separated exact origins) and
`PLAYWRIGHT_BATCH_ARTIFACTS_DIR`. The LLM cannot supply these settings
in the `browser_run_batch` tool-call arguments.

Supported steps: `goto`, `click`, `fill`, `press`, `check`,
`uncheck`, `hover`, `waitFor`, `assertText`, `assertURL`,
`scroll`, and `screenshot`. Actions are sequential. No `eval`,
shell commands, file upload, persistent credentials, or arbitrary file URLs
are exposed in this batch interface. Use the upstream MCP for other features.

Limits: at most 1,000 total actions (`steps × iterations`), 100
iterations, 180s overall deadline, and 30s per-action timeout.
Only one batch at a time per sidecar process. Every HTTP(S) origin, including each localhost port, must be explicitly
allowed locally. Redirect responses and WebSockets currently fail closed.
Blocked dependencies make the workflow fail with `policy_blocked`.
The browser blocks requests to non-allowed origins, including most third-party
scripts, fonts and CDN assets. Allow them individually if required.

Screenshots and complete step results are written beneath
`.local-batch-output/` (ignored by git). MCP replies give a compact summary
and on-disk report path rather than dumping massive traces into model context.
Fill values, assertion text, detailed Playwright errors, DOM snapshots,
and cookies are never included in successful step results. **Treat screenshots,
the workflow JSON, and reports as potentially sensitive.** Do not commit them.

## Threat model and honest limitations

- This tool uses your local browser process and machine's network access:
  run only code you trust, and do not install untrusted dependencies.
- Navigation requires explicit exact origins, including localhost ports. The browser's page content is
  untrusted, and the origin filter is not a general OS/network sandbox.
- Strict subresource filtering improves determinism but may break sites
  relying on other domains or service workers. Browser contexts should
  block service workers when adding advanced policy controls.
- Site anti-bot systems, CAPTCHA, permission checks and rate limits remain
  binding. Don't use retries to bypass these safeguards.
- Tests in `runner.test.mjs` use mocks; `integration.test.mjs` executes
  a real Chromium browser when `RUN_BROWSER_TESTS=1`.
- Persistent sessions, cross-run cancellation by job ID, per-origin pacing,
  secure profile storage, deeper isolation and full cross-browser tests are
  Codex follow-up work, **not implemented features** in this initial batch tool.
- For coding-agent tasks with limited model context, consider Microsoft
  Playwright CLI + SKILLS, which upstream recommends over MCP in some cases.

See [CODEX_HANDOFF.md](CODEX_HANDOFF.md) for the outstanding work.

## Current hardening limits

The lifecycle timer includes artifact setup, browser import, launch and actions.
Cleanup has a separate five-second ceiling per resource. Report serialization
and filesystem writes are not yet covered by a process-wide deadline. A late
launch is closed; strict process-tree kill verification remains outstanding.
Screenshots use an exclusively created per-run directory. There is no retention
quota or guaranteed screenshot secret masking yet: capture only approved data.
HTTP requests are fetched without automatic redirects/retries and fulfilled to
the browser to prevent Playwright's redirect routing bypass. All redirects are
currently rejected, including same-origin redirects. This is a compatibility
restriction of the companion only; the upstream entrypoint is unchanged.
DNS rebinding and system-wide egress isolation still require external controls.
