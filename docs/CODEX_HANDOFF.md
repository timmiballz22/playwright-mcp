# Codex implementation brief — local Playwright automation

**Repository:** https://github.com/timmiballz22/playwright-mcp
**Parent:** https://github.com/microsoft/playwright-mcp
**Baseline inspected:** ab6d67cbf8b619338f096980806fdbe29432cc4d

## Mission

Develop an exceptionally reliable local-only Playwright MCP integration,
without SaaS browser credits, public servers, proprietary browser agents,
or unnecessary model-context usage. Preserve **all original Microsoft
Playwright MCP tools and configuration**. Keep the add-on small, secure,
maintainable, cross-platform and benchmarked.

The official upstream repository is primarily a package/CLI wrapper.
**Core MCP implementation moved to the Microsoft Playwright monorepo**:
`packages/playwright-core/src/tools/mcp` and
`packages/playwright-core/src/tools/backend`; upstream tests
are in `tests/mcp`. Inspect those paths before editing upstream internals.
Upstream recommends CLI + SKILLS for coding agents when more token efficient.
Do not rewrite Playwright or substitute a screenshot-clicking bot.

## Initial implementation available

- A `local-batch/runner.mjs` declarative Playwright runner.
- A `local-batch/cli.mjs` command-line entry point.
- A separate `local-batch/mcp.mjs` stdio MCP sidecar that invokes batches.
- Bounded results, redacted action errors and local JSON reports.
- Default localhost-only policy, explicit origin allowlist and
  browser request routing. No HTTP listener or arbitrary eval.
- Offline/mock runner tests and opt-in Chromium integration test.
- GitHub Actions test workflow.
- Documentation in `docs/LOCAL_BATCH.md`.

These additions must be critically reviewed, run, fixed, hardened and
integrated. **Do not assume they have passed your environment's tests.**
Keep the full Microsoft upstream MCP server intact alongside the optional
batch companion.

## Engineering requirements

1. Inspect the fork state, parent, commit SHA, entire relevant source,
   dependencies, MCP protocol implementation, browser lifecycle, existing
   tests, process termination paths, default configuration, and credentials.
   Establish known-good baseline; avoid duplicate or shadow implementations.
2. Execute `npm ci`, inspect supported build/test commands, run full
   upstream test suite and local-batch tests in an isolated environment.
   Fix all code or CI defects discovered before claiming success.
3. Validate MCP initialization, tool discovery, dispatch, schema
   failures, real browser actions, shutdown and client disconnect.
   Verify that the SDK is correctly installed for the batch sidecar;
   promote the SDK to runtime dependencies with lockfile reconciliation
   if required to publish/reuse the sidecar.
4. Confirm real Chromium, Firefox and WebKit behavior across available
   Windows/macOS/Linux environments; distinguish emulation from physical
   phone tests.
5. Build typed, bounded and resumable long-running workflow support.
   Provide per-step results, controlled artifacts, cancellation with a
   job ID where applicable, idempotent retry decisions, proper deadlines,
   and termination of abandoned browser processes.
6. Add isolated optional persistent profiles and storage-state management,
   project-specific directories, exclusive locks, reset commands,
   robust crash recovery, and sensitive-data protection. Never commit
   profiles, cookies, tokens or screenshots.
7. Implement per-origin concurrency, configurable pacing, bounded
   retries with exponential backoff/jitter for *transient* failures,
   and HTTP 429 Retry-After compliance. Never defeat access controls,
   authentication barriers or CAPTCHAs.
8. Threat-model localhost and DNS rebinding, redirects, service workers,
   subresources, path traversal, download destinations, malicious page
   text, prompt injections, log leaks, proxy variables, and browser
   context isolation. Don't claim origin filtering is an OS sandbox.
9. Minimize tool-call overhead and model token usage; save reports
   locally and return bounded summaries. Compare against
   Playwright CLI + SKILLS using measurable benchmarks.
10. Provide robust Linux/macOS shell and Windows PowerShell bootstraps,
    example client configuration, troubleshooting, limitations,
    reproducible fixture tests and optional offline operation.
11. Benchmark cold/warm startup, throughput, memory, CPU, payload sizes
    and cleanup; optimize measured bottlenecks only.
12. Maintain Apache-2.0 attribution and upstream compatibility.
    Make logical, reviewable commits and document exact behavior.

## Mandatory execution and acceptance tests

Use the loop:
READ → ANALYZE → IMPLEMENT → EXECUTE → TEST → DIAGNOSE → CORRECT →
REGRESSION TEST → REPEAT.

Check independently:
- Local clean install and stdio MCP handshake.
- Every new and existing MCP tool remains discoverable and operational.
- One bounded workflow with at least 100 successful ordered browser actions.
- 100-iteration local-page regression execution with machine-readable results.
- Cancel and interrupt operations; no leaked browser contexts or processes.
- Browser crash, timeout, malformed inputs, missing prerequisites,
  connection disconnect, 429/Retry-After, and transient failures.
- Browser consistency on supported platforms; mobile emulation, keyboard,
  mouse, scrolling, screenshots, downloads and dialogs.
- Security tests for file URLs, external navigation, secrets in reports,
  malicious prompts, denied network subresources and local file traversal.
- Compatibility with the original upstream test suite.

**Acceptance:** real end-to-end tests must run and pass. A test added
but not executed is UNVERIFIED. If an implementation isn't finished,
document it honestly, do not silently omit it.

## Deliverable

Commit a clean and reproducibly tested fork with working stdio MCP,
well-scoped local batch and optional profile tools, sample configs,
bootstrap scripts, CI, docs, and evidence of execution.
Report exact commits, test counts, failures, browser versions,
platforms tested, performance measurements and residual limitations.
Do not pretend local Playwright removes ChatGPT usage limits.
