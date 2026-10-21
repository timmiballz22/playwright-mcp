# Fork changes (unreleased)

- Pin Playwright, playwright-core and @playwright/test together at stable 1.64.1;
  managed Chromium156, Firefox157 and WebKit27.2. Original entrypoint delegation
  remains intact. Six discovery contracts retain 25 default/72 extended tools.
- Upstream browser_find adds optional maxResults, browser_tabs adds optional
  isolatedContext. browser_wait_for time combined with text/textGone is now the
  condition timeout (upstream behavior change); time-only waits remain supported.
- Pin runtime MCP SDK1.32.1 after high-severity dependency advisories; npm audit
  --omit=dev reports zero. This audits npm dependencies, not all vendored code.
- Declare Node20 minimum consistently with bootstrap and current driver. Prefer
  Node22/24 LTS; optional durable components require Node22.13+.
- Internal bounded source job controller, atomic uncertain-lease admission fence,
  real installed queue/reconnect/death checks, and independently observed 100-run
  supervised Linux soak. Public job frontends/configuration remain unfinished.

- Private fork identity, runtime MCP SDK, local-batch tarball entries, production
  installation/handshake checks; inherited publishing removed.
- Exact operator origin policy (localhost no longer implicit), redirect SSRF fix;
  companion currently rejects all redirects and WebSockets, blocks workers.
- Unknown schema properties rejected; actions/selectors copied before async work;
  workflow v1, serialized size bound and accessible selectors added.
- CLI/MCP execution runs in an independent supervisor and worker, with owned
  browser termination, reporting deadlines and bounded temporary cleanup child.
  EOF/signals/parent death cancel work; uncertain cleanup fails closed.
- Atomic report publication and bounded regular-file UTF-8 CLI ingestion.
  Malformed/oversized MCP input and long-poll teardown have real regressions.
- Unique private artifact directories; screenshot capture requires operator opt-in.
- HTTP error classification and operator-only bounded GET navigation retry after
  429/503, disabled by default; no click, form or POST replay.
- Browser/OS CI matrix, upstream discovery schema contracts, security/lifecycle/
  screenshot fixtures, 1,000-action workflow and 100-run diagnostic soak.

Unimplemented: durable companion jobs/queues/profiles, filesystem ingestion deadlines, browser RSS/response-byte quotas, DNS/OS egress,
retention, comprehensive redaction, approved
redirect semantics, backoff scheduler and full acceptance/benchmark evidence.
See CODEX_EXECUTION_LEDGER.md. No release-readiness claim.

## Unreleased profile ownership hardening

Original CLI/library tools remain delegated. Public persistent-launch/close APIs
now acquire canonical cross-process profile leases and release after acknowledged
shutdown. This addresses WebKit's observed acceptance of a contending profile;
native confirmation of the guard is pending. Unknown launch/close, dead owner or
corrupt metadata retains the lease without automatic deletion or PID killing.
Existing profiles are not reset or repaired. See PROFILE_OWNERSHIP.md for limits.
