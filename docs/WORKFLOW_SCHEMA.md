# Workflow schema v1

Set `schemaVersion: 1` on new workflows. Legacy documents without the field are
interpreted as v1; other versions fail closed. Serialized JSON is bounded at
1 MiB; unknown top-level, action and selector fields are rejected. No expressions,
variables, scripts, shell, uploads or automatic action retries are supported.

Top-level fields: `schemaVersion`, `browser` (chromium default, firefox, webkit),
`steps` (nonempty), `iterations` (1–100, default 1), `timeoutMs` (100–180000,
default 120000), `actionTimeoutMs` (100–30000, default 5000). Each action accepts optional integer `repeat` (1–1000, default 1), an explicit
ordered repeat, not an automatic retry. Sum of action repeats × iterations cannot
exceed 1,000; bounds are checked before allocation. Example:
`{"schemaVersion":1,"steps":[{"type":"goto","url":"http://127.0.0.1:3000/"},{"type":"click","selector":{"role":"button","name":"Add"},"repeat":997},{"type":"assertText","selector":"output","equals":"997"},{"type":"assertURL","url":"http://127.0.0.1:3000/"}]}`
performs 1,000 operations on an operator-approved counter fixture. Every run
starts a fresh context/page; navigation and assertions count toward the cap. Action timeouts use Playwright auto-wait;
assertText currently reads once and is NOT a retrying expect assertion.

| Action type | Required fields | Meaning |
|---|---|---|
| goto | url | HTTP(S), exact locally approved origin; wait DOMContentLoaded for non-error responses |
| assertURL | url | Exact current URL match; target must be approved |
| click | selector | Playwright strict locator click; never auto-replayed |
| fill | selector, value | String up to 10,000 characters, including empty |
| press | selector, key | Key/chord string up to 100 characters |
| check / uncheck | selector | Set checkbox state |
| hover | selector | Hover element |
| waitFor | selector | Wait visible |
| assertText | selector, exactly one of contains / equals | Case-sensitive substring or exact complete text, up to 2,000; equals permits empty |
| scroll | none | Optional integer deltaX/deltaY, ±10,000, default 0 |
| screenshot | none | Viewport PNG; requires local sensitive-artifact opt-in |

URLs max 2,000 characters; CSS selector strings max 500. Alternative selector
objects are exactly `{ "role": "button", "name": "Save" }`, `{ "testId": "save" }`,
`{ "label": "Name" }`, `{ "placeholder": "Search" }`, or `{ "text": "Continue" }`.
Role names max 100; other values max 500. Named selectors use exact matching;
testId uses Playwright's test-id locator. Runtime errors are scrubbed rather
than echoing arguments or page content.

Policy is outside workflow JSON: CLI `--allow-origin`, MCP
`PLAYWRIGHT_BATCH_ALLOWED_ORIGINS`; capture opt-in CLI
`--allow-sensitive-artifacts`, MCP `PLAYWRIGHT_BATCH_ALLOW_SENSITIVE_ARTIFACTS=1`.
Do not put these into workflow/tool arguments. All redirects and WebSockets are
currently rejected; service workers disabled. Approved dependency origins must
be listed individually. Any blocked request fails the run.

Results contain ok/reason/browser/completed/total/durationMs, blockedRequests and
step index/type/repetition/status/duration plus approved artifact path. MCP keeps
last 10 steps + first failure and a local report path; full report stays on disk.
Reasons include cancelled, timeout, cleanup_failed, policy_blocked, action_failed;
setup errors are scrubbed as setup_failed steps. HTTP navigation failures report
httpStatus and safe codes http_401/http_403/http_404/http_4xx/http_5xx/rate_limited.
A bounded valid Retry-After header becomes retryAfterMs metadata without echoing headers.
No retries occur by default. The trusted operator may enable bounded main-GET
429/503 retries as described below; there is no durable cross-call backoff scheduler.
The synchronous batch endpoint has no job ID; the separate jobs endpoint provides durable IDs.
Once the current main GET has a final HTTP error response, it fails with that
fixed code without waiting for an error document to become ready. Configured retry
attempts run first. Subframe requests and form POSTs do not take this early-failure path.

Supervised CLI/MCP replies also include `schemaVersion`, opaque `runId`, and
`execution` cleanup metadata. An unsuccessful count has
`completionCertainty: "confirmed_lower_bound"` and `retrySafe: false`: an action
may have affected the site before its acknowledgement was lost. Do not replay it
automatically. A successful count is exact. Pre-start cancellation has exact zero
completion. Failure reasons can additionally include `worker_crashed`,
`supervisor_failed` and `execution_failed` with a safe stage. Cleanup uncertainty
blocks subsequent MCP work until the operator investigates. Process IDs are
execution diagnostics, not accepted workflow parameters or cancellation authority.

Failed steps may include `failureKind`, a fixed diagnostic code such as
`not_stable`, `pointer_intercepted`, `locator_timeout`, `pointer_action_timeout`, `target_closed`,
`assertion_mismatch` or `unknown`. It is best-effort classification, never raw
browser text or permission to replay an action. The last observed safe failure
and confirmed progress are retained if later cleanup/reporting fails.

`actionsSucceeded` confirms that all declared actions and assertions acknowledged
success. Overall `ok` also requires policy, reporting, deadline and verified cleanup.
`reportScope: "worker_execution"` describes the local report's scope: it keeps the
worker's original evidence. A final supervisor reply can resolve a cooperative
cleanup failure after independent termination/temp verification; in that case
`execution.workerCleanupFailed` is true. It never resolves an action/policy failure
into success or authorizes replay.

Clicks use the standard Locator.click action with its normal checks and deadlines.
The one-millisecond Windows Firefox input experiment failed native validation
and was reverted. No force, automatic replay or deadline increase is enabled.

Navigation retries are a separate trusted operator setting, disabled by default.
CLI `--navigation-retries 1` or MCP environment
`PLAYWRIGHT_BATCH_NAVIGATION_RETRIES=1` permits one retry; only 0, 1 or 2 is valid.
This applies only to the current explicit goto's top-level GET request on HTTP
429/503. The operator must establish that repeating those GET navigations is safe.
It never retries clicks, forms, POST, subresources, redirects, transport errors or
other HTTP statuses. Each fetch disables Playwright's own automatic retries.
Backoff starts at 500ms, doubles, and adds up to 250ms jitter. A valid Retry-After
(delta seconds or IMF-fixdate) is a minimum; if the wait exceeds the 10s local cap
or remaining execution budget, the response fails without retry. Waiting is
cancelable and shares the execution deadline. The trusted source API additionally
accepts navigationRetry with maxRetries (0–2), baseDelayMs (100–10000), and
maxDelayMs (at least baseDelayMs and at most 30000). None are workflow fields.

Termination diagnostics retain an eight-entry maximum independently of the error
code inventory. At most one first signal-error class supplements the existing
failure category: `signal_permission_denied` (EPERM/EACCES),
`signal_invalid_argument` (EINVAL), or `signal_unknown_error` (other failures).
No raw error message/code is returned. ESRCH retains its existing already-gone
handling. None of these observations grants permission to release an uncertain
lease, retry a signal with broader authority, or replay workflow actions.
`browser_ownership_unconfirmed` marks an unexpected worker exit with neither a
final receipt nor any browser ownership receipt; cleanup stays failed.
