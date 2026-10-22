# Bootstrap optional local Playwright batch tools without global package changes.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "Node.js 20+ and npm are required."
}
node -e 'if (Number(process.versions.node.split(".")[0]) < 20) process.exit(1)'
if ($LASTEXITCODE -ne 0) { throw "Node.js 20 or newer is required." }

if ($env:GITHUB_ACTIONS -eq "true") { Write-Host "::notice title=Batch bootstrap phase::phase=dependencies" }
Write-Host "Installing pinned dependencies..."
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
if ($env:GITHUB_ACTIONS -eq "true") { Write-Host "::notice title=Batch bootstrap phase::phase=browsers" }
Write-Host "Installing local Playwright browsers..."
npx playwright install chromium firefox webkit
if ($LASTEXITCODE -ne 0) { throw "Browser installation failed." }

$old = $env:RUN_BROWSER_TESTS
try {
  $env:RUN_BROWSER_TESTS = "1"
  if ($env:GITHUB_ACTIONS -eq "true") { Write-Host "::notice title=Batch bootstrap phase::phase=tests" }
  npm run test:batch
  if ($LASTEXITCODE -ne 0) { throw "Browser integration tests failed." }
} finally {
  $env:RUN_BROWSER_TESTS = $old
}
Write-Host "Local batch tools ready. See docs/LOCAL_BATCH.md."
