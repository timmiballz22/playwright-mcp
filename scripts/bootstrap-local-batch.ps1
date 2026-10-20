# Bootstrap optional local Playwright batch tools without global package changes.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "Node.js 20+ and npm are required."
}
node -e 'if (Number(process.versions.node.split(".")[0]) < 20) process.exit(1)'
if ($LASTEXITCODE -ne 0) { throw "Node.js 20 or newer is required." }

Write-Host "Installing pinned dependencies..."
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
Write-Host "Installing local Playwright Chromium..."
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { throw "Browser installation failed." }

$old = $env:RUN_BROWSER_TESTS
try {
  $env:RUN_BROWSER_TESTS = "1"
  node --test local-batch/runner.test.mjs local-batch/integration.test.mjs local-batch/mcp.test.mjs
  if ($LASTEXITCODE -ne 0) { throw "Browser integration tests failed." }
} finally {
  $env:RUN_BROWSER_TESTS = $old
}
Write-Host "Local batch tools ready. See docs/LOCAL_BATCH.md."
