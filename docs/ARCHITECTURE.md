# Architecture

Independent original, batch and optional jobs stdio endpoints preserve Microsoft's wrapper without copying
its bundled backend. `cli.js` and `index.js` delegate to pinned playwright-core;
its MCP/browser/profile/trace/video implementations remain upstream. A thin
public-API profile ownership guard now refuses competing persistent launches
and releases only after acknowledged close; see PROFILE_OWNERSHIP.md. The
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
Requests are fetched without automatic redirect following or driver retries.
An optional operator policy retries only eligible main-navigation GET429/503
responses with bounded backoff; unsafe actions are never replayed. All redirect
responses are aborted. WebSockets are closed. Any blocked request fails the workflow.

Windows jobs use a unique short browser-temp directory directly under the
protected storage base. Journal/artifact namespaces stay unchanged. This follows
native proof that a65-character protected base works while the214-character job
artifact base fails browser setup. The worker creates the temporary directory
exclusively and waits for the supervisor's ownership ACK before browser launch.
The supervisor removes only acknowledged temporary ownership; an existing or
unacknowledged directory is retained and makes cleanup uncertain. The shorter
layout alone still failed before browser launch. Run artifact allocation now
uses exclusive UUID mkdir instead of mkdtemp under the deep artifact root; the
joint layout passed native installed/public-job acceptance at6fffa27; subsequent
actual Codex checks also pass. This adds no broader disk
quota or managed-profile feature.

The frontend and independent supervisor enforce a monotonic execution deadline,
including browser setup, actions, report publication and worker exit. The
supervisor reserves cleanup time and terminates owned processes when cooperative
cancellation stalls. Parent IPC loss also triggers cleanup. Native process-tree
termination is bounded separately; uncertain cleanup fails closed and blocks new
MCP work. Direct source calls to `runWorkflow` retain their cooperative lifecycle
and are not this supervised boundary. A raw BrowserServer close failure now
triggers one additional1s-bounded public kill attempt, retaining the cleanup
failure even if that attempt succeeds. They now use the same owned, loopback
BrowserServer transport as the execution worker. Trusted test adapters without
launchServer retain their direct-launch fallback. Server ownership is retained
before observer callbacks; late allocations are killed before callbacks run. CLI file loading/parsing precedes it and
accepts only regular files and reads at most 1 MiB plus one sentinel byte.
Filesystem latency is not covered by that deadline.

Each worker has a private execution directory and temporary browser directory.
The supervisor removes temporary files after termination through a bounded cleanup
child, with retries for transient Windows file locks. Reports publish via
exclusive temporary files and atomic no-overwrite hard-link publication, not a
power-loss durable journal.
Replies contain at most ten recent steps. Failed execution counts can be confirmed
lower bounds; unsafe actions are never automatically replayed. An optional jobs MCP/foreground CLI preview wraps the durable metadata
journal, bounded controller and trusted guardian. It provides start/status/result/
cancel/list and bounded terminal artifact cleanup; default browser policy is
read-only. It requires Node22.13+ and private operator configuration. Windows
configuration uses the independently native-tested ACL helper. Native8d661bf
installed public endpoints pass all OSs; actual Codex passes Linux/Windows and
times out on macOS. Windows ownership audits contradict reported cleanup and
remain unresolved, including the Chromium functional soak. Public execution
remains experimental. Retention/full quotas, persistent
companion profiles and resume remain unfinished. Worker V8 heap is capped at 256 MiB; browser RSS and response-body
memory are not capped by that setting. The observed open-page budget defaults
to8, with an operator limit1–32 and no workflow override. It stops after page
events reveal an excess; it is not a hard OS allocation or process-tree quota.

Decision: option A (separate companion), with reusable runner entrypoint for CLI
and MCP. A facade would add protocol delegation and capability maintenance before
showing measurable benefit. The baseline used a pinned alpha. A targeted dependency upgrade to stable 1.64.1
preserves all discovered tool names, with documented optional schema additions.
Native c7ae948 original feature/profile fixtures pass across all engines/OSs,
while complete acceptance still fails on Windows raw browsers/journal and phase
fixture startup; installed auditing passes.
No repository merge or backend copy was introduced.
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

See [JOBS_MCP_PREVIEW.md](JOBS_MCP_PREVIEW.md) for exact optional jobs configuration,
foreground cancellation, cleanup bounds and remaining limitations. Job submissions
carry a monotonic deadline through queueing and guardian startup; persisted wall
timestamps support display and conservative recovery without replay.
