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
Directories are private and unique; there is no disk quota/retention controller.

The original MCP endpoint remains upstream behavior, including optional privileged
features and its own trust model. Companion restrictions do not secure that endpoint.
Execution runs in a separate worker with an independent watchdog and scoped
process termination. This is not an OS sandbox or browser RSS quota. Linux zombie
processes await host reaping; simultaneous controller loss, uninterruptible kernel
I/O and host-level failures require external supervision. CLI input ingestion still
precedes this boundary. Durable jobs and persistent companion profiles remain
unimplemented. Do not expose either stdio process as a public service.
