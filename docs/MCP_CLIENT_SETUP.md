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
endpoint integration has native installed/actual-client evidence, while complete
stability and ownership/cleanup acceptance remain open. See [JOBS_MCP_PREVIEW.md](JOBS_MCP_PREVIEW.md) for trusted configuration,
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

Jobs reserve retained artifact capacity before browser launch (512 MiB default per
private owner/project directory). Insufficient capacity returns `resource_limit`
at workspace stage with zero completed actions. Existing files remain intact.
Use explicit owner-authorized artifact cleanup/retention to make space; jobs do
not automatically delete prior artifacts. See [JOBS_STORAGE.md](JOBS_STORAGE.md)
for reservation overhead, trusted source configuration and quota limitations.

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


The standalone original CLI sets a POSIX creation mask of0077, so newly created
storage-state exports remain0600 even when the parent uses0022. Existing files
retain their prior permissions; export sensitive state to a fresh private path.
This mask does not establish Windows ACLs. Embedding the library leaves the host's
process mask unchanged; the embedding application owns its file permissions.


For POSIX Docker bind mounts, run the container with the host reader's numeric
UID/GID (`--user "$(id -u):$(id -g)"`) and choose a writable private workspace/profile
inside that mount. Fresh0077 files belong to that identity; changing permissions
to make exports world-readable is not required. The image's default user is
unchanged. The next native Docker run will verify this mapping.


When mapping a numeric Docker UID, also set writable private XDG paths for Chromium
and Crashpad. For a fresh local test workspace (the image is built locally):

```bash
mkdir -m 700 private-playwright
mkdir -m 700 private-playwright/.config private-playwright/.cache
docker run --rm -i --user "$(id -u):$(id -g)" \
  -v "$PWD/private-playwright:/workspace" -w /workspace \
  -e XDG_CONFIG_HOME=/workspace/.config \
  -e XDG_CACHE_HOME=/workspace/.cache \
  playwright-mcp-dev:latest --user-data-dir=/workspace/profile
```

This retains the image's standard headless Chromium setup and keeps shared files
owned by the host reader. The repository's corresponding native test is pending;
the prior UID-only attempt failed at Crashpad startup.


Inspect a guarded original profile without opening a browser:

```bash
playwright-mcp profile-doctor /private/project/profile
```

The single JSON response reports guard metadata and directory permissions. Exit0
means inspection found no guard (or no directory); it does not prove the profile
is unused. Exit1 reports a blocked/uncertain guard or unavailable directory; exit2
means invalid arguments. The recorded process is always identity-unverified.
Windows ACL privacy is reported as unverified. The command preserves credentials,
locks and permissions; reset/recovery still requires separate operator review.


The companion's observed open-page limit defaults to8 per workflow (main page
included). Set CLI `--max-pages N`, batch MCP `PLAYWRIGHT_BATCH_MAX_PAGES`, or jobs
`PLAYWRIGHT_JOBS_MAX_PAGES` to an integer1–32 in operator configuration. Workflow
JSON cannot override it. Exceeding the observed count stops with `resource_limit`;
action effects may have occurred and must not be automatically replayed. This
reactive limit can observe allocation after it happens; CPU/RAM/process-tree and
global project quotas remain separate open requirements. Original upstream MCP
page behavior is unchanged.
