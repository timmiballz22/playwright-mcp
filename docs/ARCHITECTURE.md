# Architecture

Two independent stdio endpoints preserve Microsoft's wrapper without copying
its bundled backend. `cli.js` and `index.js` delegate to pinned playwright-core;
its MCP/browser/profile/trace/video implementations remain upstream. The
companion is ESM JS using the same Playwright engine and a runtime MCP SDK.

Companion path: `mcp.mjs` or `cli.mjs` -> `executor.mjs` -> independent
supervisor -> execution worker -> Playwright BrowserServer. Only the worker
imports the browser runtime. A private loopback connection stays inside that
execution; only owned process IDs reach the supervisor. One workflow is active
per sidecar; concurrent calls receive a busy error.

The operator configures exact origins, artifact base directory and sensitive
capture approval. Tool JSON cannot modify these. Validation copies actions and
nested selectors before async setup. A workflow creates an ephemeral browser,
a context with service workers/downloads disabled, request policy, and a page.
Requests are fetched without redirect following/retries; all redirect responses
are aborted. WebSockets are closed. Any blocked request fails the workflow.

The frontend and independent supervisor enforce a monotonic execution deadline,
including browser setup, actions, report publication and worker exit. The
supervisor reserves cleanup time and terminates owned processes when cooperative
cancellation stalls. Parent IPC loss also triggers cleanup. Native process-tree
termination is bounded separately; uncertain cleanup fails closed and blocks new
MCP work. Direct source calls to `runWorkflow` retain their cooperative lifecycle
and are not this supervised boundary. CLI file loading/parsing precedes it and
accepts only regular files and reads at most 1 MiB plus one sentinel byte.
Filesystem latency is not covered by that deadline.

Each worker has a private execution directory and temporary browser directory.
The supervisor removes temporary files after termination. Reports publish via
exclusive temporary files and atomic rename, not a power-loss durable journal.
Replies contain at most ten recent steps. Failed execution counts can be confirmed
lower bounds; unsafe actions are never automatically replayed. There is no durable
job state machine, retention/quota controller, persistent companion profile or
resume engine. Worker V8 heap is capped at 256 MiB; browser RSS and response-body
memory are not capped by that setting.

Decision: option A (separate companion), with reusable runner entrypoint for CLI
and MCP. A facade would add protocol delegation and capability maintenance before
showing measurable benefit. No upstream sync was attempted: pinned alpha and
current monorepo differ; retain exact versions until compatibility is proved.
