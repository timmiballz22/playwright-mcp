# Companion threat model

Operator configuration is trusted. Workflow JSON, every page, redirects, selectors,
input values and site responses are untrusted. Assets include local services,
profiles, screenshots, filesystem and the model's context.

The companion accepts no arbitrary JS, shell, file URL, upload, policy override or
profile attachment. Exact HTTP(S) origins are configured by CLI/operator environment,
including localhost host AND port. Credentials in URLs are denied. Unknown keys
are rejected and validated actions are copied before asynchronous launch.

A real fixture proved Playwright route.continue does not re-intercept redirects.
Requests now use route.fetch(maxRedirects:0,maxRetries:0), and redirect responses
are aborted before following them. All redirects currently fail closed. WebSockets
are closed; service workers disabled. Any blocked request fails the workflow.
This protects fixture-tested browser requests, not all OS traffic. DNS rebinding,
proxies, browser background traffic and arbitrary compromised browser processes
require external egress controls. An allowlisted host can itself be hostile.

Errors omit raw browser messages, URL contents, assertion content and fill values.
Reports still contain timing/action metadata and absolute artifact paths.
Screenshots can contain credentials and page secrets: capture is disabled unless
the local operator opts in via CLI/environment. Use only approved fixtures/data;
pixel masking remains unimplemented. Workflow input cannot enable capture.
Worker directories are private and unique. Jobs offer bounded terminal artifact
cleanup with dry-run default. The operator CLI can page age-based cleanup of
confirmed terminal job artifacts. Results/request keys remain; ordinary batch
artifacts and profile data have no automatic age retention. Filesystem cleanup
runs in a separate bounded worker; unconfirmed exit fails and blocks this
controller. The newer local candidate reserves the project journal lease before
cleanup and retains it on uncertainty, fencing other controllers; native
validation is pending. It does not implement automatic operator repair or an OS
resource quota. Host-controlled screenshot payload budgets default to16MiB per run; browser image-buffer memory, total storage and retention remain unbounded by that limit. Atomic JSON reports separately reject more than8MiB UTF-8 before filesystem publication, including formatting/newline. Serialization memory is not bounded by that byte check.

The original MCP endpoint remains upstream behavior, including optional privileged
features and its own trust model. Companion restrictions do not secure that endpoint.
In particular, explicit devtools browser_annotate starts the upstream detached
dashboard and annotation client. Human submission/cancellation and dashboard
shutdown remain unverified; companion process-cleanup claims do not cover that
interactive lifecycle. This source review did not invoke the tool. See
TOOL_BEHAVIOR_MATRIX.md for the pending graphical operator procedure.
Execution runs in a separate worker with an independent watchdog and scoped
process termination. This is not an OS sandbox or browser RSS quota. Linux zombie
processes await host reaping; simultaneous controller loss, uninterruptible kernel
I/O and host-level failures require external supervision. CLI input ingestion still
precedes this boundary. Optional POSIX jobs MCP/CLI persist owner-scoped records and cancel on controller
exit without replay. Windows public job acceptance and persistent companion profiles
remain unfinished. Do not expose either stdio process as a public service.

Operator-enabled navigation retries are restricted to the current explicit goto's
GET main-document request after 429/503. A GET is not guaranteed harmless on every
application; the operator must establish replay safety before enabling the local
setting. Tool input and page content cannot enable it. No action/POST replay or
redirect following is authorized; every attempt retains exact-origin checks.

The delegated original endpoint now guards cooperating persistent launches with
canonical filesystem leases and acknowledged public context close. Dead/corrupt/
disconnected ownership fails closed without stale PID kills or deletion. This is
not a private Windows ACL implementation, managed profile reset, OS sandbox or
restriction on original code/network capabilities. Other software or the same OS
user can ignore/tamper with markers; dedicated private profile directories remain
necessary. See PROFILE_OWNERSHIP.md. The optional jobs owner UUID scopes records
within a local service and is not authentication against the same OS user.


The temporary-directory cleanup adapter separately bounds owned-handle exit
confirmation after its operation deadline. A receipt alone cannot certify cleanup,
and late receipt/close cannot override its monotonic deadline. Failed or unconfirmed
shutdown returns false; existing supervisor/job uncertainty fencing stays in effect.
The controlled EOF test suspends a JavaScript filesystem promise in the actual
worker; it is not proof against uninterruptible kernel I/O or host failure.

Durable jobs reserve retained logical artifact bytes before browser effects under
the existing project lease (512 MiB default per private owner directory). The
supervised scan fails closed on unsafe entries, byte/entry/depth limits and I/O
failure; its existing execution deadline also bounds a stalled scan. It reserves
the full screenshot allowance, report ceiling and diagnostic allowance, retaining
prior files on refusal. This does not prevent same-user external writers or bound
temporary browser data, physical disk allocation or other artifact directories.
Custom trusted source callers must serialize any shared directory across leases.
