# Architecture

Two independent stdio endpoints preserve Microsoft's wrapper without copying
its bundled backend. `cli.js` and `index.js` delegate to pinned playwright-core;
its MCP/browser/profile/trace/video implementations remain upstream. The
companion is ESM JS using the same Playwright engine and a runtime MCP SDK.

Companion path: `mcp.mjs` or `cli.mjs` -> `executor.mjs` -> independent
supervisor -> execution worker -> Playwright BrowserServer. The supervisor is
detached on all platforms so Windows libuv parent-exit cleanup cannot kill it
before it handles frontend IPC loss. Its own Windows children stay attached. Only the worker
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
and are not this supervised boundary. They now use the same owned, loopback
BrowserServer transport as the execution worker. Trusted test adapters without
launchServer retain their direct-launch fallback. Server ownership is retained
before observer callbacks; late allocations are killed before callbacks run. CLI file loading/parsing precedes it and
accepts only regular files and reads at most 1 MiB plus one sentinel byte.
Filesystem latency is not covered by that deadline.

Each worker has a private execution directory and temporary browser directory.
The supervisor removes temporary files after termination through a bounded cleanup
child, with retries for transient Windows file locks. Reports publish via
exclusive temporary files and atomic rename, not a power-loss durable journal.
Replies contain at most ten recent steps. Failed execution counts can be confirmed
lower bounds; unsafe actions are never automatically replayed. There is an internal durable metadata journal, bounded source controller and trusted guardian bridge, but no public durable
job execution API, retention/quota controller, persistent companion profile or
resume engine. Worker V8 heap is capped at 256 MiB; browser RSS and response-body
memory are not capped by that setting.

Decision: option A (separate companion), with reusable runner entrypoint for CLI
and MCP. A facade would add protocol delegation and capability maintenance before
showing measurable benefit. The baseline used a pinned alpha. A targeted dependency upgrade to stable 1.64.1
preserves all discovered tool names, with documented optional schema additions.
Native acceptance is pending; no repository merge or backend copy was introduced.
Historical decision: pinned alpha and
current monorepo differ; retain exact versions until compatibility is proved.

Worker reports retain original execution evidence, tagged worker_execution. Final
supervisor replies include independent cleanup verification. A failed cooperative
close can be reconciled after worker exit, owned process termination, temp removal
and report publication within budget; the original failure remains in metadata.
Actions, policy and report errors are preserved. This prevents false failure after
confirmed effects and verified cleanup without replaying those effects.

Trusted source callers can supply `beforeWorkerStart({pid})` to executeWorkflow.
When configured, the supervisor creates an idle worker and withholds its start
packet until the frontend acknowledges successful admission. This lets a future
job guardian persist ownership before browser actions. Throwing rejects admission
with journal_unavailable; a pending admission remains under the same independent
watchdog deadline. Cancellation/deadline blocks late acknowledgement. Failure
before acknowledgement has exact zero action completion and remains retrySafe=false.
The normal CLI/MCP do not configure this hook. It is not accepted in workflow JSON
or a public job API, and callback code is trusted source code, not model input.
