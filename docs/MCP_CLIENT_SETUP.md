# Local stdio setup

Requires Node.js 20+; use a maintained Node 22 or 24 LTS installation for new
setups. The internal durable job components require Node 22.13+ (node:sqlite).
Node 18 is unsupported. Durable jobs reject early Node23.x below23.4 because
SQLite is not flag-free there. No global MCP
configuration is required to run CLI workflows. This fork is private and is not
published as Microsoft's npm package.

Clone https://github.com/timmiballz22/playwright-mcp, run `npm ci`, then
`npx playwright install chromium`. Linux may require administrator installation
of browser libraries using Playwright's documented install-deps command.
Bash: `bash scripts/bootstrap-local-batch.sh`; Windows PowerShell:
`./scripts/bootstrap-local-batch.ps1`. Native CI results are required for each OS;
local Linux cannot certify macOS/Windows setup. Bootstrap tests now include
security fixtures requiring all three browsers; install them before running the
full suite with `npx playwright install chromium firefox webkit`.

Codex config template (replace paths and origins with operator-approved values):

```toml
[mcp_servers.playwright]
command = "node"
args = ["/absolute/playwright-mcp/cli.js", "--browser=chromium", "--isolated", "--headless"]

[mcp_servers.local_playwright_batch]
command = "node"
args = ["/absolute/playwright-mcp/local-batch/mcp.mjs"]
env = { PLAYWRIGHT_BATCH_ALLOWED_ORIGINS = "http://127.0.0.1:3000" }
```

On Windows use absolute paths with forward slashes, e.g.
`C:/Projects/playwright-mcp/local-batch/mcp.mjs`. Do not add `--port` or
an HTTP transport: both entries communicate over stdin/stdout. The delegated original
entrypoint exposes `browser_run_code_unsafe` in its core tool set and labels it
RCE-equivalent server-side JavaScript. Use it only with trusted operator-authored
code; page content cannot authorize that use. Companion restrictions apply only
to the separate declarative batch/jobs endpoints, which accept no code.

Optional screenshot capture requires operator environment
`PLAYWRIGHT_BATCH_ALLOW_SENSITIVE_ARTIFACTS = "1"`. Screenshots can contain
secrets; there is no pixel masking. Origins include exact scheme/host/port;
localhost access is not implicit. Redirects and WebSockets are rejected.

Verified pathway: SDK stdio initialize, ping, discovery and actual batch browser
calls, plus independent production tarball handshakes. Codex CLI 0.163.0 app-server was verified with temporary config overrides:
both endpoints discovered, original navigation passed, and one compact batch
tool call completed 1,000 operations in 33.882s. No model turn was started.
Interactive conversational use and native Windows/macOS Codex are not verified. It does not install a plugin into a
ChatGPT iPhone app. A local process must be launched by a local MCP-capable client.
Client/model quotas, machine limits and website rate limits still apply.

For missing browsers install the matching pinned Playwright build from this
checkout. For rejected requests inspect the locally configured origin list;
do not let a page or model widen it automatically. The one-tool batch endpoint has no durable job IDs. The optional jobs
preview below persists records; closing its controller cancels work, with no
background daemon or automatic resume.

The verified original endpoint explicitly selects managed Chromium. Without
`--browser=chromium`, upstream defaults to branded Chrome, which may require a
separate installation. Avoid assuming a managed Chromium download installs Chrome.

## Optional jobs preview

Node22.13+ is required. Windows private ACL helper tests pass; its public
endpoint integration is experimental and awaits native acceptance. See [JOBS_MCP_PREVIEW.md](JOBS_MCP_PREVIEW.md) for trusted configuration,
default read-only policy, cancellation and bounded cleanup. A separate registered
owner UUID identifies each local client; it is not same-OS-user authentication.

```toml
[mcp_servers.playwright_jobs]
command = "node"
args = ["/absolute/playwright-mcp/local-batch/jobs-mcp.mjs"]
env = { PLAYWRIGHT_JOBS_OWNER_ID = "f2f119da-c36a-466a-af26-5fe8afcb0a65", PLAYWRIGHT_JOBS_PROJECT_DIR = "/absolute/approved-project", PLAYWRIGHT_JOBS_ALLOWED_ORIGINS = "http://127.0.0.1:3000" }
```

Replace paths/origin and generate a stable UUID for your registration; the UUID
above illustrates format. Tool input cannot alter this configuration. Sensitive
capture and browser mutation actions are disabled by default. Application state
defaults to a private `~/.local/state/playwright-batch/jobs` directory; unsafe
existing permissions are rejected without repair. Keep owner/project settings
stable to inspect persisted jobs across reconnects; no work is replayed.

Actual verified Linux source entrypoint:
`/workspace/playwright-mcp/local-batch/jobs-mcp.mjs`, using Node at
`/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node`.
These paths describe this workspace, not another machine's installation.

The repeatable real-client acceptance command is:

```sh
node scripts/verify-codex-jobs.mjs /opt/codex/bin/codex
```

Use your installed Codex executable (or omit the argument for PATH lookup). It
serves an owned local fixture, uses temporary `-c` configuration and an ephemeral
thread, starts no model turn, then audits cleanup. CodexCLI0.163.0 discovered all
six tools, started the primary job in9ms, completed exactly1,000 actions through
bounded result polls, denied a foreign owner and retained duplicate-key behavior
after artifact deletion. A separate active job canceled after1 confirmed action.
The combined check took35.623s and left zero active owned processes. It did not
edit global MCP configuration. This is local Linux protocol evidence, not a native
Windows/macOS conversational walkthrough, billing benchmark or release gate pass.

The optional actual-client verification script accepts a Codex native executable
or its installed `bin/codex.js` launcher as its first argument. The launcher uses
Node directly, including Windows, with temporary `-c` MCP registration and an
ephemeral workspace-write thread. No model turn or global configuration write.
Pinned0.163.0 Node-launcher Linux verification passes; new native CI jobs await
acceptance. This does not certify a conversational model or remove model quotas.
