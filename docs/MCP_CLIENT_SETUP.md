# Local stdio setup

Requires Node.js 20+ for the companion test/bootstrap path. The upstream package
engine remains >=18; companion Node 18 verification is outstanding. No global MCP
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
an HTTP transport: both entries communicate over stdin/stdout. The upstream
entrypoint has its own trust model and optional privileged code capabilities;
companion restrictions do not apply to it.

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
do not let a page or model widen it automatically. Durable job IDs, reconnect
execution and background daemon supervision are not available.

The verified original endpoint explicitly selects managed Chromium. Without
`--browser=chromium`, upstream defaults to branded Chrome, which may require a
separate installation. Avoid assuming a managed Chromium download installs Chrome.
