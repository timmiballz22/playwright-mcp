# Fork changes (unreleased)

- Retry only confirmed-close init COMMIT timeouts within the existing initialization attempt budget; preserve store identity and never replay job mutations. Publish checkout-only cancellation witnesses atomically, retain full failure audit rows, and add matching Chrome first-frame diagnostics. Native98 failures remain open; native99 verification pending.

- Archive native97 failures and retained client evidence. Add a checkout-only actual-client journal timing preload and separate Mac diagnostic job; production runtime, existing jobs and limits remain unchanged. Retain a portable public-API first-JPEG reproducer.

- Fail SDK startup diagnostics on client-close errors and retain failed stores;
  preserve primary plus cleanup causes in actual Codex verification. Record
  bounded init-phase/worker-exit hints and actual app-server close observation.
  No journal timeouts, SQLite settings, retry or cleanup authority change.
- Preserve failed group-hint control evidence and report fixed failure phases;
  optional snapshot-failure callbacks keep the original coverage/row/byte limits.
  Full-host row-cap failures remain invalid; isolated namespace QA is not a
  production isolation or global-cleanup guarantee.
- Native96 still has320×98 input/gray recording. Failed headless alternatives
  were rejected and9f975 restored; no additional browser fix ships.

- Add one same-deadline read-only retry for Chromium's exact capture-unavailable
  protocol error. Persistent/other/closed/timeout failures remain failures.
  Real-browser calibrated controls and fresh Node22 production package pass
  locally; native recovery remains unverified. Prepared core identity changes
  from3eb68a0 through local2e36b79 to9f9750a; known migrations are guarded,
  matrix-onlyB46 remains rejected. Order existing Chromium window-bounds completion
  before device metrics, targeting native95 short320×98 screencast input; local
  scheduling calibration passes, native geometry/cause/fix remains pending.

- Consume SDK acceptance-client stderr to prevent pipe backpressure; retain only
  bounded fixed guardian/journal facts shared with the Codex verifier. Add fixed
  CI failure classes/durations and conservative stock-browser close diagnostics.
  This does not establish a causal fix for native journal/provider failures or
  change production execution policy, deadlines or default transport.

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
