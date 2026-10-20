# Fork changes (unreleased)

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
- HTTP error status classification, Retry-After metadata, no automatic request replay.
- Browser/OS CI matrix, upstream discovery schema contracts, security/lifecycle/
  screenshot fixtures, 1,000-action workflow and 100-run diagnostic soak.

Unimplemented: durable companion jobs/queues/profiles, filesystem ingestion deadlines, browser RSS/response-byte quotas, DNS/OS egress,
retention, comprehensive redaction, approved
redirect semantics, backoff scheduler and full acceptance/benchmark evidence.
See CODEX_EXECUTION_LEDGER.md. No release-readiness claim.
