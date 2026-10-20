# Release checklist — blocked

This is a private source/tarball distribution. `npm publish` is blocked by
package.private; the inherited registry publishing workflow has been removed.
No npm/MCP registry ownership is asserted. Do not restore OIDC publishing until
a separate authorized release review establishes ownership and evidence.

1. Run all G00–G18 checks in CODEX_EXECUTION_LEDGER.md. Incomplete/failed/queued/
   cancelled work cannot pass release.
2. Run npm ci, npm run lint, npm test and real companion suite on native OSs.
3. Run node scripts/verify-package.mjs: inspect exactly packed files, independent
   npm install --omit=dev and both installed stdio handshakes.
4. Require full green wrapper and companion CI at the exact candidate SHA;
   branch protection is currently unverified (API 403).
5. Complete offensive security fixtures, process ownership/cleanup, durable jobs,
   profiles, retention, rate-limit policy and 45-scenario matrix.
6. Repeat 1,000-action workflow and soak with browser process-tree resource metrics,
   token/latency benchmarks and capability behavior beyond schema discovery.
7. Review for secret-bearing reports/screenshots/profiles and generated binaries.
8. Keep a tested commit/tag and tarball integrity locally; do not publish packages
   under Microsoft identities or silently replace upstream tools.

Rollback: stop local stdio clients, preserve approved sensitive artifacts/profiles
in operator-controlled storage, checkout the prior tested commit in a separate
clone, run its pinned npm ci/browser install, and update the client's absolute
entrypoint. Do not reset user profile data or force-push history to roll back.
