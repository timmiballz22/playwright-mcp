# CODEX MASTER MISSION: LOCAL PLAYWRIGHT ENGINE — COMPLETE ENGINEERING, SECURITY, QA AND RELEASE PROGRAM

**Execution target:** https://github.com/timmiballz22/playwright-mcp  
**Upstream:** https://github.com/microsoft/playwright-mcp  
**Inspected fork baseline:** main at df1f1674e0841483e16d151fbdd0cf0328883bfa  
**Mission class:** production-grade local-first browser automation tool, not a prototype  
**Client:** Codex on a computer, with optional other stdio MCP clients  
**Priority:** reliability > security > regression preservation > usefulness > efficiency > extra features  
**Instruction:** implement, execute, test, fix, retest, and document rather than merely proposing an architecture.

---

## 0. The non-negotiable outcome

Build the most reliable, comprehensive, maintainable **local Playwright automation implementation practical within this codebase**. It must be usable by Codex through standard input/output MCP and optionally by CLI, work directly on a user's computer, and avoid public hosting, SaaS browser-agent credits, and dependency on an always-on remote server. It should combine **Microsoft's original Playwright MCP features** with a rigorously engineered **batch/job engine** that can perform many safe, bounded browser operations with a small number of model calls.

The desired product is NOT merely a command-line script that opens Chromium, nor another nominal "browser plugin" with unchecked limitations. It is an auditable local automation system with exhaustive regression testing and trustworthy status reporting.

**Do not claim that local automation removes ChatGPT/Codex usage allowances, server/tool request timeouts, target-site restrictions, hardware limits, CAPTCHAs, login approval, or website rate limits.** It removes third-party per-browser-action pricing when no hosted provider is involved; everything else must be modeled and handled honestly.

**Preserve the upstream Microsoft implementation and avoid modifying unrelated behavior.** If an existing upstream feature already solves a requirement, reuse it; do not waste time rebuilding it or inflate MCP tool schemas. Never rely on bypassing user authorization, account access controls, or website restrictions.

**Do not create or require an external HTTP browser server.** The default deliverable uses local stdio MCP and a local CLI. Some optional browser protocols inherently use localhost/pipe connections; these are internal implementation details, not a hosted service. HTTP/CDP connection to external browsers is optional, separately approved, and disabled by default.

The user wants an unusually strong result, not cosmetic polish. Work in measured stages, finish high-risk functionality first, and report only what actually passes.

---

## 1. Verified state and evidence (do not overwrite this with assumptions)

At the time of this handoff, the user's fork was examined using GitHub. The GitHub repository was confirmed to be a real fork of microsoft/playwright-mcp; main commit **df1f1674e0841483e16d151fbdd0cf0328883bfa** merged pull request #1. The repository retains the original upstream files plus a separate local-batch folder, scripts, documentation, and new CI.

Existing new files:
- local-batch/runner.mjs — declarative ordered browser workflow executor.
- local-batch/mcp.mjs — separate stdio MCP server exposing browser_run_batch.
- local-batch/cli.mjs — JSON workflow command-line runner.
- local-batch/report.mjs — local report writer and bounded MCP reply.
- local-batch/runner.test.mjs — mocked validation, failure and cleanup tests.
- local-batch/integration.test.mjs — real Chromium 100-click fixture.
- local-batch/mcp.test.mjs — real stdio MCP handshake and 100-click fixture.
- scripts/bootstrap-local-batch.sh and scripts/bootstrap-local-batch.ps1.
- .github/workflows/local-batch.yml.
- docs/LOCAL_BATCH.md and docs/CODEX_HANDOFF.md.

**Verified at fork's merged main:**
- Local batch QA run https://github.com/timmiballz22/playwright-mcp/actions/runs/39466914643 completed successfully.
- That job ran 7 Node tests: **7 passed, 0 failed**, including a real Chromium 100-click browser test and a real MCP-handshake + 100-click integration test.
- Upstream CI run https://github.com/timmiballz22/playwright-mcp/actions/runs/39466915214 had successful lint, Ubuntu, Windows and Docker jobs when inspected; macOS job was QUEUED, so full matrix PASS was **not established** at that inspection.
- Previous CI runs marked failure because a macOS job was cancelled; no confirmed functional failure was established from those cancelled jobs. Inspect the exact historical logs rather than assuming a code defect.
- Local source cloning in the previous assistant's container failed on DNS for github.com. GitHub connector read/write and GitHub Actions execution worked. Codex should use its own checkout and run real local tests.

**DO NOT relabel the fork "complete" based on 7 tests.** It covers only a small fraction of the desired functionality. Read the entire repo and obtain a fresh baseline before coding.

Upstream architecture is especially important: the Playwright MCP core was moved into https://github.com/microsoft/playwright (not this wrapper repo), specifically:
- packages/playwright-core/src/tools/mcp
- packages/playwright-core/src/tools/backend
- upstream test suite tests/mcp

The wrapper fork's original cli.js invokes packaged playwright-core internals, and src/README.md explicitly points to the upstream monorepo. Adding custom files to src/ will NOT magically extend those bundled core capabilities. Choose an explicit integration strategy rather than assuming this is a traditional self-contained server implementation.

The official Playwright MCP README currently documents roughly 72 named browser tool operations across navigation, input, storage, network, tracing, recording, inspection, testing, developer tools, video, PDF, and more. These are capability-gated; the presence of documentation does not mean every tool is active in every configuration. **Feature preservation must use tool-discovery and behavior tests, not just count function names.**

---

## 2. Immediate high-priority audit findings you must independently verify and resolve

### RISK-001 — Production package and runtime MCP SDK

The fork package.json still names the Microsoft package @playwright/mcp, version 0.0.83, and keeps @modelcontextprotocol/sdk in **devDependencies**. The new local-batch/mcp.mjs imports that SDK at runtime. Consequently npm ci --omit=dev, a production installation, can lack the dependency required to execute the new sidecar. Fix production reproducibility: choose a safe distribution design, move dependencies as appropriate, update the lockfile deterministically, and run a fresh production-mode installation smoke test. Never publish over or impersonate Microsoft's npm scope.

### RISK-002 — Fork distribution/packaging mismatch

The inherited .npmignore whitelists only upstream README, LICENSE, cli.js, index.* and config.d.ts; it excludes the new local-batch directory and bootstrap scripts from the published tarball. The existing official npm command using @playwright/mcp@latest installs **Microsoft's package**, not this fork. Produce accurate fork-specific installer/package metadata, tarball checks, and genuine installed-client tests. Use a distinct package identity if publishing is actually required; consider unbundled source checkout + stdio first to avoid needless distribution complexity.

### RISK-003 — Inherited publishing automation

The fork contains .github/workflows/publish.yml and server.json aimed at Microsoft's @playwright/mcp and io.github.microsoft/playwright-mcp identities. These upstream release workflows must **not** publish under Microsoft's names from the fork, even accidentally. Disable or safely gate inherited publishing until a legitimate fork identity, ownership, approvals, OIDC trust, package metadata and registry scope have been established. Test that fork pushes, releases and workflow_dispatch cannot accidentally invoke an unauthorized publish.

### RISK-004 — Broad implicit localhost access

The batch runner's allowedAddress function currently permits any http://localhost, http://127.0.0.1 and http://[::1] URL without explicit port restrictions. This can unexpectedly expose internal dashboards and privileged local services to agent-driven browsing. Treat local services as sensitive; require explicit, operator-side project-scoped destination policy, and design a user-approved development-origin exception. Verify WebSocket handling, proxies, redirects, hostname canonicalization, IPv4/IPv6 variants, DNS changes/rebinding, path escaping, and whether traffic is observable beyond Playwright request routing. Make the browser network policy fail closed for the stated threat model. A Playwright routing filter is **not an OS network sandbox**. Document residual limitations and support external egress controls where stronger guarantees are needed.

### RISK-005 — Timeouts do not cover the entire lifecycle

The workflow's 180-second timer currently starts after browser.launch, context creation and request routing. A stalled launch may escape this bound. Cancellation can race between a pre-check and abort listener registration. Cleanup operations and report writes also need finite ceilings. Define a complete deadline budget including validation, launch, context setup, actions, screenshots, cleanup and reporting. Prove signal handling, client disconnects, timeouts and process termination with tests. Watch for orphaned browsers on Windows, Linux and macOS.

### RISK-006 — Screenshot collision and sensitive artifacts

Screenshots currently use predictable names such as step-0001.png in a shared output directory. Multiple independent runs or MCP sidecars may overwrite each other's artifacts. Create per-run unique directories with exclusive creation, atomic writes, secure permissions, retention limits, profile-specific partitioning and cleanup. Ensure screenshots, traces, videos, HARs, HTML and logs are treated as potentially sensitive data. Confirm redaction behavior with seeded fake secrets, not slogans.

### RISK-007 — Failures lose diagnostic precision

The workflow catches action failures and exposes only action_failed; the MCP sidecar reduces setup exceptions to a generic error type. This avoids revealing secrets, but can make diagnosis nearly impossible. Introduce safe structured error codes and diagnostic artifacts, with policy-controlled redaction of URL query strings, credentials, cookies, input values, environment variables and page content. Guarantee deterministic error taxonomy and include stage, action index, elapsed time, transient/permanent classification, and an opaque log reference. Do not leak raw Playwright errors to the model by default.

### RISK-008 — No durable jobs or persistence yet

The new batch tool is synchronous, one-at-a-time in a single MCP process, without persistent user profiles, job IDs, recovery or cross-call cancellation. It has no resumable workflow semantics. A long loop still occupies a model tool call and may exceed its client timeout. Design bounded local job execution with job IDs, persistent status, cancellation and optional resume only when semantically safe. Minimize repeated tool calls, but do not claim a background daemon is automatically running after the hosting application has stopped.

### RISK-009 — Tests cover Chromium happy paths only

The 7 new tests prove useful functionality but do not cover Firefox/WebKit, production-mode installs, browser crashes, 429 responses, WebSockets, popup isolation, malicious redirects, credential redaction, SIGTERM, repeated runs, corrupted profiles, inaccessible files or sustained load. Expand with deterministic local fixtures and real browsers. Upstream CI covers broader MCP tests but not every new batch feature.

### RISK-010 — Fixed policy versus legitimate application complexity

The default request routing blocks every non-allowlisted origin and blocks service workers. This can break real web apps depending on third-party CDNs, authentication providers, websocket APIs, telemetry or service-worker offline paths. Avoid silently treating blocked subresource failure as success. Permit explicit, reviewed, project-scoped dependency origins; report blocked requests and their effects. Distinguish security tests with service workers disabled from deliberate functional tests of PWA/service-worker behavior. Do not quietly widen the default allowlist.

### RISK-011 — Weak schema and assertion semantics

The workflow validator checks a subset of fields and allows ignored extraneous values when invoked directly from CLI. AssertText uses case-sensitive substring matching from textContent, not Playwright's robust expect API. Selector-only workflows lack accessibility-role/test-id ergonomics, frame selection, visibility assertions, negative conditions, stable waits or reusable variables. Implement formally versioned declarative schemas with exhaustive validation and typed feature semantics. Avoid unbounded eval and unsanitized expression execution.

### RISK-012 — Uncontrolled CI minutes and ambiguous checks

The current local-batch GitHub Actions trigger covers push and PR; rapid commit sequences created many redundant jobs. Add sane concurrency/cancel-in-progress rules, least-privilege permissions, timeouts, cache discipline and a reproducible matrix. Ensure canceled prior runs are distinguished from genuine test failures. Keep a single clean final commit SHA with a complete passing acceptance record.

### RISK-013 — Browser routing affects performance

Playwright's browserContext.route() can disable HTTP caching. The strict all-requests route in the batch runner may skew performance benchmarks and slow real sites. Benchmark both security-enabled routing and approved non-routing scenarios, without weakening protection on untrusted sites. Distinguish cold start, warm page/cache, true client latency, and browser operation latency.

### RISK-014 — Unimplemented platform and feature promises

Do not advertise persistent sessions, crash-safe resume, unlimited calls, perfect anti-bot access, filesystem access, native iPhone execution, Safari-on-iPhone coverage or full cross-browser behavior without real evidence. Electron/Chromium mobile emulation is not physical iOS Safari. StdIO servers generally run on the computer where an MCP-capable client launches them, not directly inside the iPhone ChatGPT app.

---

## 3. Source-of-truth read phase: mandatory inspection before edits

Read all project code that could be affected, and write a concise baseline report before implementation. Specifically:
1. Git status, remotes, parent history, fork root, branches, tags, releases, commits, worktrees, merges, protection settings and open issues/PRs.
2. README.md and all generated tool docs, CONTRIBUTING.md, CLAUDE.md, SECURITY.md, LICENSE, .gitignore, .npmignore, server.json and package metadata.
3. cli.js, index.js, index.d.ts, config.d.ts, package-lock.json, playwright.config.ts, roll.js, update-readme.js.
4. Every local-batch source file, its mock tests, real-browser tests, MCP tests and scripts.
5. Every existing upstream wrapper test and relevant fixtures.
6. All workflows under .github/workflows, dependency updates, Dockerfile and publishing pipelines.
7. Current official documentation and implementation in microsoft/playwright at packages/playwright-core/src/tools/mcp and packages/playwright-core/src/tools/backend.
8. Relevant official upstream Playwright MCP, Playwright CLI/SKILLS, MCP SDK and protocol docs. Verify current API signatures against pinned versions.
9. Session lifecycle, transport handlers, tool registration, tool naming, logging, browser contexts, input handling, downloaded file path semantics and permission gates.
10. Existing features before writing replacements, especially persistence, routing, browser profiles, idle timeout, storage, tracing, console, screenshots, videos, WebMCP and capability registration.

Deliver docs/BASELINE_AUDIT.md with a feature map, exact commit SHA, source references, dependency tree, reproducibility commands, cross-platform support status, risk register and test results. Do not edit an unfamiliar subsystem blindly.

If the fork is already out of date with upstream, classify the differences and decide whether a targeted upstream sync is safe. **Never force-reset or blindly merge upstream changes that erase custom functionality.** Preserve the user's fork and use reviewed PRs.

---

## 4. Product architecture and isolation requirements

The final design should have clear boundaries:
- **Transport layer:** local stdio MCP connection, strict protocol; no unsolicited HTTP listener.
- **Tools layer:** stable, versioned tool schemas, concise descriptions and predictable output; no oversized context dump.
- **Orchestration layer:** bounded workflow validator, scheduler, cancellation, reporting and job lifecycle.
- **Execution layer:** genuine Microsoft Playwright API, not brittle pixel-only scripts or reinvented browser protocol.
- **Browser manager:** launches, contexts, tabs, profiles, resource budgets, owner tracking, cleanup and crash handling.
- **Storage layer:** per-project and per-run artifacts, profile state, encrypted or OS-protected secrets where feasible, journal and retention.
- **Policy layer:** origin and file allowlists, destructive-action policy, read/write separation, data redaction, caller/authorization boundaries.
- **Observability layer:** tests, diagnostic event stream, structured failure codes, traces, metrics, reproducible fixture replay.

Prefer composed modules with explicit interfaces over a gigantic stateful file. Pick TypeScript/ESM or justified JS/ESM consistently; no scattered CommonJS/ESM hacks without tests. Maintain compatibility with pinned versions and supported Node LTS. Avoid new runtime dependencies unless objectively warranted.

### Integration decision record

Evaluate these design options with a short decision record and actual test evidence:
A. Maintain original Microsoft Playwright MCP and a separately invoked local batch stdio MCP tool.
B. One local MCP facade that aggregates/delegates original tools + batch tools without forking internal monorepo behavior.
C. Reusable local TypeScript package with adapters for CLI, MCP and optionally Playwright CLI/SKILLS.
D. Upstream contribution strategy versus fork-specific additions.

**Preference:** a thin fork-specific companion library with optional independent stdio tools if this achieves safe maintainability and compatibility. Integrate tools into a single MCP endpoint only if it demonstrably reduces client overhead without duplicating or destabilizing upstream code. Ensure original tools remain discoverable through their supported entry point. Label this tradeoff clearly.

No external server dependency. If optional remote/HTTP mode is added, it must be separate, disabled by default, authenticated, documented and independently tested—not quietly activated.

---

## 5. Original Playwright feature preservation checklist (zero regressions)

Discover actual MCP capabilities dynamically from official supported configuration and compare baseline/final. Preserve existing upstream behavior for the appropriate mode, including:

**Navigation:** browser_navigate, back, close, tabs, tab selection/create/close, navigation waits, URL handling, redirects, page reload and popups.

**Interaction:** click, double click, right click, hover, drag, dropdown, keyboard keys/chords, text input, form fill, file upload, focus/blur, checkbox, radio, rich editors, scroll/wheel and pointer/mouse controls.

**State:** cookies, localStorage, sessionStorage, storage state export/import, permissions, viewport, device emulation, profiles, cache behavior and isolated contexts.

**Observation:** structured accessibility snapshots, DOM snapshots, screenshots, selection and highlighting, accessible locator generation, page console messages, page errors, network requests/responses, timings and browser configuration.

**Advanced:** network routing and mock responses, network offline state, API request tools, trace start/stop, recording/video, screenshot capture, PDF, WebMCP-enabled page tools, developer tools, and testing assertions.

**Optional/privileged:** browser_evaluate, browser_run_code_unsafe, init scripts, file reads/writes and remote CDP capabilities require explicit trust configuration. Existing upstream optional capability exposure must remain compatible, but default-for-fork elevated capabilities should be conservative.

**Tool capability inventory:** For every named operation documented by the pinned version, record: name, source, supported clients/browsers, enabled capabilities, sample fixture, expected behavior, test status, compatibility notes. Do not claim the 72+ documented names are all enabled simultaneously.

Create contract tests that snapshot tool discovery for representative capability configurations; tolerate documented upstream additions while detecting dropped functionality or changed parameter semantics.

---

## 6. Declarative workflow language — complete and safe

Define a versioned JSON schema with documented semantics and strict fail-closed validation. All fields typed; reject unknown action types and unknown security-significant fields. Restrict schema depth, total JSON size, action count, string length, selector length, expected output size and nesting. Require a migration/version story for old workflow documents.

Recommended workflow groups (only expose what is testable):
- Navigation: goto, back, forward, reload, switch/create/close tab, frame navigation.
- Elements: click, doubleClick, hover, fill (including empty values), clear, press, check, uncheck, selectOption, setInputFiles (workspace-restricted), dragTo, focus, waitFor.
- Assertions: url, title, text, value, count, checked/unchecked, attribute, visible/hidden, enabled/disabled, screenshot match, HTML accessibility and console/network invariants.
- Control: bounded repeat/forEach, conditional branch over whitelisted observation values, explicit waits, retry policy, fail/continue mode, named steps, variable substitution with length/escape limits.
- Observation: screenshot, snapshot, count, text, attribute, console summary, response status, timing, browser trace references.
- Accessibility-first selectors: role + exact accessible name, label, placeholder, test-id, text and CSS. Avoid guessing selectors from page text; preserve locator strictness, uniqueness and auto-waiting.
- Canvas/mobile: optional coordinates and gestures only when operator-approved; record device scale, viewport, transform and image evidence.
- Project tests: synthetic keyboard/mouse/touch, frame timing, request failures, responsive viewport variants, high-DPI and color-scheme checks.

Implement a declarative AST rather than evaluating arbitrary user-supplied JavaScript expressions. If expert mode deliberately enables Playwright code execution, it must be separate, locally configured, visibly high-risk, capability gated, bounded and disabled by default for agent-supplied content.

Use Playwright's native auto-wait and expect capabilities where appropriate. Don't add gratuitous sleeps or retries that conceal actual application bugs. Repeated UI actions must be deterministic with stable element references, frames and tabs. If navigation produces HTTP 404/500 or page errors, differentiate transport success from application-test success.

All actions must have clear idempotence classification. Do not automatically replay POST, checkout, purchase, irreversible deletion, email sending, publishing, financial transfer or user-account mutations.

---

## 7. Durable local job orchestration

Implement a job manager suitable for tool-call timeouts and high iteration counts without an external service:
- start_workflow: validates, queues/starts work, returns opaque job ID quickly.
- get_workflow_status: status, stage, percentage, last milestone, timestamps, safe error and bound resource metrics.
- get_workflow_result: bounded result subset, report path and pagination/chunks.
- cancel_workflow: idempotent cancellation by authorized owner.
- list_workflows: recent jobs in current project, bounded.
- cleanup_workflows: retention-based cleanup of finished jobs/artifacts.
- optional retry_workflow: only after confirming safe-to-replay steps and explicit policy.
- optional resume_workflow: restart from a durable checkpoint **only** when tests show replay safety; otherwise require fresh run.

Define a state machine: CREATED -> VALIDATING -> QUEUED -> RUNNING -> {SUCCEEDED, FAILED, CANCELLED, TIMED_OUT, CRASHED} with transition invariants. Distinguish not_started, paused, operator_attention_required and expired if truly supported. Persist durable state atomically, with schema version, timestamps, owner/project identity and atomic file updates. Prevent double execution after client reconnects. Handle process termination using an explicit parent/worker design; document that shutdown of the machine ends execution absent a configured supervisor. Do not promise that ChatGPT can supervise or continue beyond its session without an independently started local executor.

Bound queue length, running jobs, contexts, CPU, memory and browser processes. Avoid global locks that prevent unrelated projects from making progress. Prefer bounded worker pools and backpressure over unconstrained parallel tabs.

Cancellation must interrupt active browser actions and forcefully clean up only the resources owned by that job. Never kill a browser process belonging to an unrelated application. Test repeated cancellation, cancel-before-start, cancel-during-launch, cancel-during-download, cancel-during-trace, exit during report write, and user signal handling.

---

## 8. Persistent sessions and authentication without exposing secrets

Provide three clearly differentiated modes:
1. Ephemeral isolated contexts: default for tests, no persistent credentials.
2. Per-project opt-in persistent profile with exclusive lock, on-disk isolation, retention and secure cleanup.
3. Optional attach to an existing browser through officially supported channels, with explicit trusted-device/operator approval and without inheriting unrelated tabs by default.

Re-use upstream user data directories, isolated mode and storage-state APIs when possible. Do not implement an insecure duplicate profile manager. Ensure sessions never cross project/user boundaries. Test cookies, local/session storage, IndexedDB where relevant, service-worker state, storage partitioning, profile lock behavior, crashes and recovery.

Secrets must never appear in default model-visible logs, traces, screenshots, JSON files, Git commits, CI artifacts or tool schemas. Use OS facilities or established secret storage when practical; don't invent weak encryption. Require explicit opt-in to capture authenticated traces/videos/HAR; redact headers and values, offer retention/deletion. Credentials must not be printed to stdout (stdio must remain valid MCP JSON-RPC stream). Never assume a GitHub secret or Google login is transferable between chat, cloud, browser and local processes.

Provide a safe manual sign-in handoff without bypassing MFA/CAPTCHA. Operators can sign in themselves where needed; automation resumes only with valid authorization.

---

## 9. Browser lifecycle and robustness guarantees

Handle:
- Missing browser binary, executable mismatch and install guidance.
- Unsupported Node or operating system, missing OS libraries, browser permissions.
- Browser spawn failure, disconnection, crash, memory exhaustion, SIGINT/SIGTERM.
- Browser/context/page closure races, stale tabs, frame detachment and popup races.
- Infinite navigation, slow pages, suspended service worker, redirect loops, invalid certificates.
- Disconnected MCP client, malformed JSON-RPC, canceled call, unusual transport close.
- Multiple independent MCP clients and resource ownership.
- Browser profile already in use, lock contention, orphaned/partial state.
- Screenshot/trace/video failure, full disk, read-only filesystem, long paths on Windows.
- Stalled process exits, async callbacks raising after shutdown, double-close.
- Single run repeated thousands of times without monotonically increasing unreleased handles.

Use full-lifecycle deadlines and cancellation propagation, not only per-action timeouts. Select deterministic error classes and hide sensitive values. Every test must assert resource cleanup, not just success output. Handle non-terminating cleanup with a bounded last-resort process kill scoped to the launched process tree.

---

## 10. Security and consent policy (treat as release blocker)

Write docs/THREAT_MODEL.md and a tested policy module.

Assets: local filesystem, browser profiles, cookies, authentication tokens, loaded pages, connected SaaS accounts, localhost services, LAN hosts, agent-client context, screenshots, request headers, GitHub CI credentials.

Attacker-controlled inputs: page text, HTML/ARIA content, URLs, redirects, downloaded files, QR/barcodes, clipboard, links, tool arguments, workflow JSON, poisoned selectors, console logs, server responses, WebMCP descriptions and browser extension data.

Threat cases and controls:
- Prompt injection from web content: tool outputs are untrusted data, never privileged system instructions; prevent page text from authorizing file, network or account changes.
- SSRF/local-network abuse: prevent agent-selected access to unexpected localhost ports, private addresses, link-local/cloud metadata, LAN, VPN and rebinding targets; exact operator-approved host + port policies, with appropriate DNS/IP checks and network-level sandbox recommendations. Don't claim Playwright routing alone enforces system-wide sandboxing.
- Redirects: validate each hop and browser request independently, including popup first request, frame navigation, WebSocket and non-HTTP protocols. Test tricky URL encodings, IPv6 canonicalization and credentials in URL.
- File access: workspace-bound relative paths, canonicalization after symlink resolution, temporary directories, no arbitrary file:// navigation or global filesystem reads by default.
- Downloads/uploads: filename sanitization, path traversal rejection, file size/type policies, temporary safe directory, permission checks, malware considerations.
- Browser scripts: no untrusted eval, shell commands, arbitrary Node import or OS command execution in default workflow; privileged expert features require operator activation.
- Permission escalation: explicit approval on destructive/irreversible actions; maintain least privilege even if a browser is signed in.
- Sensitive data: redact tokens, cookies, Authorization headers, POST bodies, form inputs, query parameters, DOM secret fields, screenshot/trace metadata; test with seeded canary strings.
- Profiles: encrypted/protected storage where feasible, restrictive permissions, exclusive locks and deletion support.
- Policy changes: policies come from local operator configuration, not MCP tool-call arguments or the visited page.
- Outbound network: allowlisting is not a magic sandbox. Audit proxy behavior, DNS resolution, redirects, browser extensions and service-worker coverage.
- MCP: validate schema at runtime and server boundaries; protect STDIO protocol from stray logs; do not start unauthenticated public transport.
- Supply chain: pin appropriate dependencies/actions, inspect licenses, lockfile reproducibility, vulnerabilities and unexpected lifecycle scripts. Fix confirmed issues, report advisory-only cases.
- Reporting: no raw secrets in CI logs, crash dumps, exception traces or model-visible summaries.

Never automate bypass of anti-bot controls, CAPTCHAs, access restrictions, paywalls or account authorization. Respect site terms and rate limits. Explain residual risks candidly.

Mandatory offensive/negative fixture tests: malicious redirect to local metadata target, redirect from allowed domain to blocked domain, localhost service attack path, encoded file URL, symlink escape, disguised mixed-case host, IPv6 alias, DNS change simulation, popup to blocked host, WebSocket cross-origin attempt, service-worker routing gap, profile file permission check, malicious selector/input, untrusted page text instructions, and seeded secret leakage.

---

## 11. Rate limits, network fairness and efficient execution

The user's most painful problems are **ChatGPT usage budgets and rate limits**. Optimize legitimately:
- Use one concise high-level tool call for large deterministic workflows, not one model call for each click.
- Batch at the **local executor** while limiting memory, output and wall time.
- Return job IDs for long tasks so no single MCP request needs to remain open.
- Cache static discovery, schemas, locator summaries and safe results only when semantically valid.
- Use content hashes/ETags where appropriate for public unchanged resources; don't cache sensitive authenticated responses without permission.
- Limit parallel browser contexts per machine/project and requests per origin.
- Respect HTTP 429, Retry-After, 503 and legitimate site throttles with explicit backoff + jitter and maximum retry attempts.
- Avoid retrying non-idempotent submissions.
- Support queuing, deadlines, load shedding and user-visible reason codes.
- Report limits as separate categories: client/model quota, MCP tool-call timeout, OS/process resources, website quota/anti-bot, server network restrictions, and CI quota.
- Explicitly reject attempts to evade website rate limits, rotate identities to circumvent account restrictions or hide automated activity.

Benchmark "model calls to perform 100 correct actions" for upstream MCP, new batch MCP and Playwright CLI + SKILLS. Compare **total tokens transferred, wall-clock duration, fail rate and peak RSS**, not just number of calls. Upstream itself recommends CLI + SKILLS for token-constrained coding agents, so if the hybrid CLI is faster or cheaper, support it rather than insisting MCP alone wins.

---

## 12. Browser and UX quality assurance coverage

Build realistic local test fixtures, no dependence on unstable external sites for core tests.

### Interaction matrix
Clicks, double clicks, right clicks, hover, enter, Tab, Shift+Tab, Enter, Space, Escape, shortcuts, modifier combos, drag/drop, text selection, RTL/Unicode, IME where possible, textarea, password fields, contenteditable, disabled controls, dropdowns, radio, checkbox, file inputs, popovers, menus, modals and dialogs.

### Navigation/document matrix
SPA route changes, full navigations, same-document hash changes, history back/forward, redirects, cross-origin frames, same-origin frames, popup/new tab, tab closing, nested shadow DOM, dynamic rendering, delayed hydration, virtual lists, infinite scroll, animation, network-idle anti-patterns and unload.

### Test assertions
Visible/hidden, enabled/disabled, text including whitespace/Unicode, element count, URL, title, form value, aria role/name, geometry/bounds, stable screenshot difference (tolerance), console errors, HTTP errors, failed requests, performance budgets and accessibility checks. Fail with descriptive but redacted errors.

### Device and input
Chromium desktop + emulated mobile touch, viewport/DPR changes, portrait/landscape, zoom, prefers-color-scheme, reduced-motion, media emulation, keyboard/pointer combinations. Firefox and WebKit browser-level parity where supported. Physical iOS is out of scope unless a real device provider is configured and separately tested.

### Game/map/canvas workloads
Browser animation loops, requestAnimationFrame simulation, WebGL canvas presence, pointer lock handling, touch dragging, keyboard held/repeated input, FPS sampling, runtime errors, GPU/renderer detection, responsive hit regions, continuous input tests, pixel-difference snapshots where stable, high-resolution map interaction and no unexpected input interruptions. Do NOT claim full game physics or accessibility correctness from a screenshot-only check.

### Audio/video/media
Permission prompts, audio autoplay restrictions, video playback state, media loading errors, device emulation caveats. Test platform-specific constraints and report unsupported capabilities instead of bluffing.

### Authentication and uploads
Login only with authorized fixtures, state persistence, session expiration, CSRF errors, file upload validation, image thumbnail previews, storage cleanup and profile isolation. Never use real personal credentials in CI.

---

## 13. Observability, diagnostics, artifact handling

Every run must produce an identifiable summary with:
- Unique job/run ID and schema version.
- Start/end timestamps, duration and timeout budget.
- Client/runtime/browser/OS version, launch mode and test fixture identity.
- Number of total/completed/failed/skipped steps.
- Step-level timings and a scrubbed status/error class.
- Browser process context ownership and cleanup status.
- Optional console error count, failed request count, 4xx/5xx count, blocked-origin count, retry count, throttle count.
- Deterministic location of logs/traces/screenshots with retention policy.
- High-level resource metrics: RSS, CPU, active contexts/pages, artifact bytes.
- Reproducible input workflow checksum.
- User-approved environment configuration summary without secret values.

Artifacts should be collision-free, atomic and privacy-safe. Archive useful failure traces only by explicit policy, apply quotas to disk use and age, and offer an operator-visible clean/reset path. Use Playwright Trace Viewer when available; screenshots should have safe metadata, viewport and step associations.

Output to model should be compact and bounded, with structured fields, safe error codes and a pointer to local reports. In stdio mode NEVER print human debug logs on stdout; stderr is appropriate for local diagnostics with redaction.

---

## 14. Performance program: evidence instead of unsupported promises

Establish baselines before optimization. Run on an identified machine/CI runner and report conditions:
- Cold start to browser-ready.
- Warm reuse and context creation latency.
- MCP initialize + tools/list + one tool call.
- Single click end-to-end median/p95.
- 100-action and 1,000-action workflow throughput.
- Repeated 100-run job stress with memory leak detection.
- Large DOM accessibility snapshot latency and token size.
- Mobile emulation interaction latency.
- Console/network instrumentation overhead.
- Network-origin restriction overhead, including cache-disabled effect.
- Artifact write speeds, screenshot output size, disk retention behavior.
- Peak process tree memory, handles, tabs and contexts.
- Browser exit duration after success, failure, cancellation and crash.

Performance acceptance should be **relative to measured baselines and correctness-preserving**:
1. No statistically meaningful reliability regression compared with the tested baseline.
2. No resource leak detectable after N repeated local fixture runs using explicit tolerance and observed noise.
3. No unaudited removal of request routing, assertions, screenshots or browser state checks to make benchmarks look fast.
4. Bounded output independent of page verbosity by default.
5. Low model-context overhead compared with unbatched action-by-action operation.
6. Any performance target that cannot be met should be reported with measurements and concrete bottleneck, not quietly relaxed.

Provide benchmark scripts, raw results, environment details and chart/table summary. Never invent benchmark numbers.

---

## 15. Complete testing pyramid (required)

Implement tests at each layer, not just happy-path Chrome clicks.

**A. Static checks**
Lint, type-check, API contract, strict JSON schema, dependency/license audit, secret scan, package tarball inspection, docs-link verification, formatting, generated README consistency.

**B. Pure unit tests**
Workflow schema boundaries, enums, parsing, origins, URLs, ports, loops, variable interpolation, retry classification, quotas, redaction, report format, state-machine transitions, idempotence, timeout calculations, unique artifact directory creation, policy config.

**C. Property/fuzz tests**
Unexpected JSON shapes, null prototypes, huge strings, weird Unicode, nested structures, invalid URL encodings, selector poisoning, arbitrary key names, unknown steps, iteration overflow, race edges. Each property has deterministic seeds and timeouts.

**D. MCP protocol contract tests**
Initialize negotiation, stdio handshake, tools/list, tool name and schema, good/bad calls, concurrency behavior, structured/bounded responses, errors without secret leakage, cancellation, disconnect, restarted client reconnect behavior and stdout cleanliness.

**E. Real browser tests**
Chromium, Firefox and WebKit on deterministic local fixtures, as supported by OS. Test interaction semantics, page navigation, forms, popups, snapshots, artifacts and console/network.

**F. Failure injection**
Corrupted browser state, missing binary, browser crash, port already used, readonly filesystem, disk full simulation, temporary path collisions, slow/stalled page, 429 + Retry-After, 503, request timeouts, browser disconnect, process SIGTERM, user cancellation, double shutdown, stale lock.

**G. Security regression**
Every item from the security threat model, including localhost, file access, credential canaries, redirects, worker gaps, protocol handling, output redaction and untrusted page content. Do not satisfy these merely by mocking allowAddress; exercise a real browser where relevant.

**H. End-to-end operator experience**
Fresh git checkout and README installation on Windows PowerShell, macOS shell and Linux shell; CLI workflow; fresh MCP client config; original upstream MCP client connection; new batch job; report viewing and cleanup; invalid config error quality; production install without devDependencies.

**I. Upstream compatibility**
Run the existing original fork test suite, lint/docs regeneration, TypeScript compilation (if added), and representative capability tests. Pin tool-schema snapshots by version. No original feature lost.

**J. Longevity/soak**
Real browser 1,000-action workflow; 100 successive runs; multi-project isolation; competing clients; memory/handle leak thresholds; controlled concurrency; cancellation under load. Daily stress CI may be a separate optional job to save minutes, but release must have a verified soak record.

Every test must be executed and its result captured. Mark skipped/unsupported separately. Avoid a CI configuration that can silently skip real-browser tests while still reporting success. Maintain deterministic fixtures and avoid network-dependent flakiness.

---

## 16. Acceptance grid — concrete gates before READY

Track each criterion with ID, test ID, source file, command, result, operating system/browser, evidence URL, and status (PASS, FAIL, SKIP-WITH-REASON, NOT-TESTED).

**G00 BASELINE:** fresh clone, full existing test suite, original tool-discovery snapshot, no unreviewed worktree changes.

**G01 INSTALL:** clean npm ci; production package/sidecar install; tarball presence; fresh Node version compatibility; package metadata correctly brands fork.

**G02 MCP:** stdio handshake; schema; tool calls; sequential/concurrent behavior; client disconnect; graceful shutdown; no stdout contamination.

**G03 FEATURE PARITY:** all original supported capability groups can be discovered and representative operations pass; no user-visible behavior removed.

**G04 BATCH:** 1,000 real browser actions via one validated workflow (or scoped job start + poll), with exact counter and no unexpected duplicates.

**G05 RETRIES:** 429/503/transient errors back off only under configured policy, respect Retry-After, never automatically replay unsafe writes.

**G06 JOBS:** deterministic states, cancellation, deadline, job IDs, no orphaned browser processes, clean restart semantics.

**G07 SECURITY:** deny unauthorized local and external destinations; no file escape; no untrusted script execution by default; no secret canaries in outputs; all approved exceptions explicitly operator-controlled.

**G08 STORAGE:** per-run unique artifacts; no overwrite; secure permissions; bounded disk usage; retention and safe cleanup.

**G09 AUTH/PROFILES:** ephemeral isolation and opt-in profiles, lock ownership, session restore/reset and no cross-project leakage.

**G10 CROSS-BROWSER:** Chromium, Firefox, WebKit fixture coverage; unsupported platform combos documented honestly.

**G11 CROSS-OS:** Linux, macOS and Windows clean install, CLI and MCP smoke tests; native GitHub Actions evidence or explicitly documented local equivalent.

**G12 PERFORMANCE:** published baseline and repeatable benchmark results, no worse correctness or major memory leak, bounded default MCP response.

**G13 ACCESSIBILITY/MOBILE:** representative ARIA-based selectors, keyboard-only fixture, touch simulation and responsive screenshot tests.

**G14 ADVANCED:** tabs, frames, dialogs, file upload, network capture, tracing, video/PDF as enabled by corresponding upstream capabilities; no false feature claim.

**G15 RELEASE SAFETY:** fork publishing cannot use Microsoft's package/registry identities; release checklist and token permissions secured.

**G16 DOCUMENTATION:** exact Codex local-client setup, architecture, examples, troubleshooting, scope limitations, threat model and API reference.

**G17 AUDIT EVIDENCE:** every gate has a linked log/artifact/command and commit SHA; no incomplete work labeled VERIFIED.

**G18 CLEAN MERGE:** no broken original commands, no generated accidental binaries/secrets, all essential CI jobs green, no unresolved critical issues.

A missing critical gate means NOT RELEASE-READY. Tests that are irrelevant to a mode may be SKIP-WITH-REASON with explicit scope; do not mark them PASS. Unsupported physical iOS testing cannot be replaced by mobile emulation and should remain accurately scoped.

---

## 17. CI and release engineering

Make CI a reliable release gate, not an expensive source of redundant runs:
- Read-only GITHUB_TOKEN for test jobs; write only where essential.
- Concurrency groups per branch/PR, cancellation of superseded runs.
- Clear job names, matrix strategy, bounded test timeout and maximum run time.
- Separate quick PR checks, full browser matrix, nightly stress, manual release gate.
- Node LTS matrix for versions actually supported by the package.
- Linux, macOS, Windows tests for native setup; Docker test only if the fork still supports optional Docker.
- Browser install cache and lockfile integrity.
- No secrets inside tests; no publication from PRs.
- Pin third-party actions or justify versioning, verify supply-chain provenance where feasible.
- Publishing disabled by default until fork namespace, registry trust and provenance are correct.
- Release smoke test installs the artifact that would actually ship (not just source checkout).
- Release tags map to tested commits; provide reproducible release notes and changelog.
- Dependabot/security alerts handled as separate engineering work.
- Establish upstream sync plan without automatically replacing local customizations.

Investigate historical canceled macOS workflow runs, but treat "cancelled" separately from assertion failures. Require a *fresh* fully green matrix at final release.

---

## 18. Documentation and developer experience

Ship the following accurate documents:
- docs/BASELINE_AUDIT.md — analyzed baseline, risk register, current behavior.
- docs/ARCHITECTURE.md — components, process ownership, state diagrams and schema boundaries.
- docs/THREAT_MODEL.md — assets, attack paths, defenses, residual limitations.
- docs/LOCAL_BATCH.md — operator quickstart, examples, limitations.
- docs/MCP_CLIENT_SETUP.md — Codex STDIO setup on supported OSs; verified local pathways and client caveats.
- docs/WORKFLOW_SCHEMA.md — versioned JSON schema, every action, validation and errors.
- docs/TEST_MATRIX.md — exact cross-browser/OS acceptance coverage.
- docs/PERFORMANCE.md — measured baselines, benchmark scripts and result interpretation.
- docs/RELEASE_CHECKLIST.md — package provenance, publication safety and reproducible build.
- docs/CHANGELOG.md — feature/risk changes, compatibility notes.
- docs/CODEX_EXECUTION_REPORT.md — final evidence, commands, commit SHAs and unresolved issues.

Provide examples for local HTML and a local HTTP fixture, standard SPA, long batch, read-only navigation, allowed external site, screenshots, cancellation and profile reset. Provide PowerShell, bash and Codex client configuration, with verified real paths. Avoid claiming an official ChatGPT iPhone app can launch arbitrary local stdio tools.

Developer commands should be small, predictable, cross-platform and automated. Good error messages give exact install fixes without leaking secrets.

---

## 19. Implementation phases and priority order

**PHASE 0 — Reproduce before edit**  
Clone, inspect, identify current HEAD/parent, read full relevant paths, run existing CI-equivalent tests, obtain exact tool inventory. Write baseline audit and evidence table. NO feature development until baseline understood.

**PHASE 1 — Stop release/security footguns (P0)**  
Fix inherited publish identities, production runtime dependency, tarball/package mismatch, implicit localhost exposure, malformed/untrusted workflow validation, unauthorized file/origin access, secret leakage and lifecycle timeouts. Add failing tests first, then minimal safe fixes.

**PHASE 2 — Strong stable batch foundation (P0/P1)**  
Implement schema version, robust selectors/assertions, origin policies, report isolation, cancellation, precise errors, safe instrumentation and non-destructive behavior. Run real cross-browser batch tests.

**PHASE 3 — Durable execution and profiles (P1)**  
Job manager, queues, state machine, checkpoints, safe cancellation, profile manager, locks, lifecycle guardrails, no orphan processes. Keep default ephemeral mode.

**PHASE 4 — Preserve and integrate upstream (P1)**  
Feature contract matrix; make original tools and fork batch work together with minimal model context. Preserve tool compatibility and capability gates. Decide on single facade only with proven benefit.

**PHASE 5 — Comprehensive QA and performance (P1)**  
Run feature matrix, fuzz/property tests, negative security tests, cross-OS/browser, 1,000-action real batch, stress/soak and benchmarks. Repair failures and regressions. Don't optimize by removing checks.

**PHASE 6 — Packaging and operator experience (P1)**  
Clean local install, production tarball/sideload behavior, Codex stdio setup, docs, examples, safe upgrades, no external hosting. Release CI and rollback.

**PHASE 7 — Polish and conditional extras (P2)**  
Optional recorder, advanced visual comparison, richer WebGL/game tests, session dashboards, interactive browser attach and advanced analytics only after P0/P1 gates pass.

At every phase: READ -> HYPOTHESIS -> FAILING TEST -> FIX -> REAL EXECUTION -> REGRESSION -> VERIFY -> COMMIT. If a method fails, investigate and switch to a technically sound alternative; remove obsolete patches, don't pile up duplicate overriding implementations.

---

## 20. Explicit anti-goals / things not to do

- Do NOT create a public web service or force Cloudflare/Vercel hosting.
- Do NOT use TinyFish, browser credit APIs or a paid agent service as the primary browser engine.
- Do NOT promise unlimited model/API usage.
- Do NOT silently substitute playwright-cli, screenshots, mock tests or descriptions for functional MCP integration.
- Do NOT rewrite Microsoft's browser engine.
- Do NOT remove original upstream tools to make the fork smaller.
- Do NOT publish under @playwright/mcp or Microsoft MCP registry identity.
- Do NOT introduce a tool that evaluates arbitrary untrusted JavaScript/shell by default.
- Do NOT allow an AI page to change local security policy or approve high-risk actions.
- Do NOT bypass website controls, authentication, CAPTCHAs or rate limits.
- Do NOT auto-retry financial, administrative, destructive or irreversible mutations.
- Do NOT hardcode credentials, tokens, test account secrets or session cookies.
- Do NOT claim physical iOS/Safari verification from Chromium emulation.
- Do NOT call unexecuted tests a pass, skipped tests a pass or queued CI green.
- Do NOT ignore infrastructure constraints; record them accurately and continue productive checks wherever possible.
- Do NOT spend most of the project on branding, dashboard polish or output wording while reliability/security remain unverified.

---

## 21. Required response structure after each internal execution milestone

Maintain an on-disk execution ledger, not endless conversational progress messages. Codex should report concrete evidence at meaningful checkpoints:

A. **Baseline** — current commit, upstream reference, differences, installed/runtime versions, starting failures.  
B. **Changes** — files, intent, security implications, tests added, compatibility rationale.  
C. **Verification** — exact commands, test count, pass/fail/skip, OS/browser, CI URLs, performance.  
D. **Outstanding** — P0/P1/P2 and uncertainties, exact reproduction, follow-up.  
E. **Release gate** — G00–G18 PASS/FAIL/SKIP/NOT-TESTED with evidence.  
F. **Result** — final tested commit and clone/install commands, truthful limitations.

Do not stop after one failing test unless a genuine technical barrier prevents further execution. When blocked on a service, switch to independent local fixture tests and security/unit checks where available. Never quietly claim that work completed that was only planned.

---

## 22. Concrete test scenarios that must become executable

1. Fresh clone on Ubuntu, npm ci, browser installation and upstream MCP launch.
2. Fresh clone on Windows with PowerShell bootstrap and working stdio handshake.
3. Fresh clone on macOS with bash bootstrap and browser launch.
4. Fresh production-mode install where devDependencies are absent.
5. Inspect package tarball and verify local-batch files are present when advertised.
6. Verify publish workflow cannot publish Microsoft's artifact from this fork.
7. MCP initialize, list tools and real local page navigation from a clean Codex client.
8. Exact 1,000-click/operation workflow with deterministic final DOM counter.
9. 100 iterations of a state-reset workflow with no carryover unless explicitly requested.
10. Two concurrent job submissions queue/cap correctly and do not overwrite screenshots.
11. Two MCP clients cannot hijack each other's job IDs or project profiles.
12. Cancellation while browser launches and while locator wait is pending.
13. Client closes stdio while browser runs: no leaked process after configured shutdown policy.
14. SIGINT/SIGTERM kills owned browser child processes without corrupting job journals.
15. Browser forcibly crashes during screenshot: structured failure, no ghost successful result.
16. Slow navigation exceeding end-to-end deadline: correctly timed out, cleanup verified.
17. Invalid step type, wrong parameter, extra property, empty fill and oversize JSON.
18. Cross-domain redirect from approved origin to denied destination gets blocked.
19. Unknown localhost port is not implicitly approved by trusted project policy.
20. URL with credentials, IPv6 literal, encoded special characters and file:// gets denied.
21. Symlink traversal from an approved upload directory cannot read outside workspace.
22. Popup, iframe and WebSocket network policies enforce approved scope.
23. Service worker request interception limitation is explicitly tested and reported.
24. Screenshot files across 20 runs are unique, retained or deleted by policy and not committed.
25. Canary token in fake input or HTTP header never appears in model-visible summaries or CI logs.
26. Browser unexpected 401/403/404/429/500 is classified distinctly from JS exception.
27. HTTP 429 Retry-After backoff obeyed, no busy retry loop; non-idempotent POST not replayed.
28. CSS, test-id and accessible role/name locators produce expected deterministic results.
29. Dialog/popup/cross-frame interactions work without timing-related false positives.
30. Mobile viewport + touch emulation yields correct DOM events, DPI and screenshots.
31. Keyboard hold/release and repeated Space simulation on local canvas fixture.
32. Dark-mode and reduced-motion preference propagation, with assertions.
33. Page console error and failed request capture produce bounded redacted output.
34. Storage isolated across contexts; opt-in persistence survives restart only for its own project.
35. Corrupt profile/lock state is diagnosed, not silently erased or cross-used.
36. Local job persistence across client reconnect is proven if implemented; if not, report limitation.
37. Parallel browser contexts stay within configured CPU/RAM/process caps.
38. Long-running soak test tracks RSS, handles, open pages and file descriptors.
39. Upstream original screenshot, network, storage, PDF, video/tracing tools still function where enabled.
40. No extra HTTP port listener appears when running default local stdio mode.
41. Pure CLI workflows work entirely without connected ChatGPT or internet (against local fixtures).
42. Large DOM snapshot returns bounded representation rather than unbounded tokens.
43. Repeated full test suite has no unexplained flakiness; investigate intermittent failures.
44. Release from main is blocked until CI/evidence matrix passes.
45. Final installation document works for a user starting with no global MCP configuration.

Each scenario needs an automated test or a reasoned operator-test entry with evidence. Add more where code analysis reveals risk.

---

## 23. Optional features only after core release criteria

- Developer-selectable deterministic virtual clock for time-driven web apps and games.
- Browser trace replay assist, local visual diff snapshots and OCR-free DOM-first inspection.
- Performance budgets, Web Vitals/local profiling, JS heap sampling and CPU sampling.
- HAR record/replay and HTTP response mocks restricted to operator-approved files.
- Test case generation from captured authorized workflow actions.
- Graph/coverage reports across pages, browser configurations and test cases.
- Single-command local smoke-test harness for any local HTML app or dev server.
- Shell/PowerShell interactive project bootstrap with no automatic network exposure.
- CLI + SKILLS interface for Codex to compare against MCP context/latency.
- Readable optional TUI/dashboard running strictly on localhost, only if it provides real diagnostic value and does not introduce new security problems.

For each optional feature, demonstrate actual value, run tests, and state impact on resources. If not safe or not measurable, defer it without claiming completeness.

---

## 24. Final acceptance and exact deliverable

The final product must be a **genuine local tool**, with actual stdio MCP integration and a robust browser runner, installable from the user's fork, without external hosting, no third-party browser-agent credits, and with the original Microsoft's Playwright MCP capabilities preserved.

The release package must include:
1. Working local execution source and package/entrypoints.
2. A secure and versioned batch/job API.
3. Working installation scripts on supported platforms.
4. Clear Codex MCP configuration and tested actual client usage.
5. Automated unit, MCP, integration, cross-browser, negative-security and performance tests.
6. Docs, example workflows, feature inventory, threat model and compatibility notes.
7. Completed acceptance grid G00–G18 with evidence.
8. A clean mainline commit and CI results.
9. A reproducible release and rollback strategy.
10. A factual performance comparison against original MCP and CLI/SKILLS.
11. Explicit report of any unsupported features, failed tests, unverified platforms and usage limits.

### Absolute verification discipline

**Implementation ≠ verification.**
**No console errors ≠ no bugs.**
**One Chrome demo ≠ browser compatibility.**
**A succeeded GitHub Actions job ≠ all features tested.**
**Local Playwright automation ≠ unlimited ChatGPT/Codex tool calls.**
**An MCP repository ≠ an automatically installed ChatGPT mobile plugin.**
**A configured allowance ≠ a security boundary.**

Use actual tests, exact evidence, truthful labels and reliable engineering.

**START WITH THE SOURCE AUDIT AND THE P0 FINDINGS. IMPLEMENT AND VERIFY IN THE SAME CODING SESSION. CONTINUE FIXING FAILURES UNTIL THE DEFINED GATES ARE SATISFIED OR A DOCUMENTED TECHNICAL BLOCKER PREVENTS THEM. DO NOT DECLARE THE PROJECT RELEASE-READY UNTIL EVIDENCE SUPPORTS IT.**
