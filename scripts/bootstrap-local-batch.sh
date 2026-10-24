#!/usr/bin/env bash
# Bootstrap optional local Playwright batch tools. Does not install global packages.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Node.js 20+ and npm are required." >&2
  exit 1
fi
node -e 'if (Number(process.versions.node.split(".")[0]) < 20) process.exit(1)' || {
  echo "Node.js 20 or newer is required." >&2
  exit 1
}
ci_phase() {
  if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    printf '::notice title=Batch bootstrap phase::phase=%s\n' "$1"
  fi
}
ci_phase dependencies
echo "Installing pinned dependencies..."
npm ci
ci_phase browsers
echo "Installing local Playwright browsers..."
npx playwright install chromium firefox webkit
ci_phase tests
echo "Running mocked and real-browser QA..."
npm run test:batch
echo "Local batch tools ready. See docs/LOCAL_BATCH.md."
