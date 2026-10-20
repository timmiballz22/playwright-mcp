# Architecture

Two independent stdio endpoints preserve Microsoft's wrapper without copying
its bundled backend. `cli.js` and `index.js` delegate to pinned playwright-core;
its MCP/browser/profile/trace/video implementations remain upstream. The
companion is ESM JS using the same Playwright engine and a runtime MCP SDK.

Companion path: `mcp.mjs` or `cli.mjs` -> `runner.mjs` validation/policy/browser
lifecycle -> `report.mjs` bounded model reply plus local JSON report. There is
one synchronous active workflow per sidecar; concurrent calls receive a busy
error. No HTTP listener or paid browser provider is required.

The operator configures exact origins, artifact base directory and sensitive
capture approval. Tool JSON cannot modify these. Validation copies actions and
nested selectors before async setup. A workflow creates an ephemeral browser,
a context with service workers/downloads disabled, request policy, and a page.
Requests are fetched without redirect following/retries; all redirect responses
are aborted. WebSockets are closed. Any blocked request fails the workflow.

Lifecycle timer covers browser import/launch/context/actions. Stop races active
operations, closes owned context/browser, and closes resources that arrive late.
Cleanup has a separate five-second ceiling per resource. MCP EOF/signals abort
the active workflow and close transport. Process-tree hard termination, report
write ceilings and crash-safe durable worker journals remain incomplete.

Artifacts use exclusively created private run directories. JSON reports use
random IDs and exclusive writes, and return at most ten recent steps. There is
no persistent job state machine, retention/quota controller, optional companion
profile, resumable execution or automatic retry engine. Reuse upstream profiles
and supported storage APIs when implementing those features.

Decision: option A (separate companion), with reusable runner entrypoint for CLI
and MCP. A facade would add protocol delegation and capability maintenance before
showing measurable benefit. No upstream sync was attempted: pinned alpha and
current monorepo differ; retain exact versions until compatibility is proved.
