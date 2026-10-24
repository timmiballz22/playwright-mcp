// Optional Linux operator benchmark of the released official CLI, zero model turns.
// Run with an independently installed @playwright/cli entry point as argv[2].
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ownedDescendants } from '../local-batch/fixtures/process-audit.mjs';
assert.equal(process.platform, 'linux', 'This observer is scoped to Linux');
const entry = path.resolve(process.argv[2]);
const require = createRequire(entry);
const cliVersion = JSON.parse(await readFile(path.join(path.dirname(entry), 'package.json'))).version;
const driverVersion = require('playwright-core/package.json').version;
try { await readFile(path.join(os.homedir(), '.playwright', 'cli.config.json')); throw new Error('Benchmark requires no inherited global official CLI config'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const directory = await mkdtemp(path.join(os.tmpdir(), 'official-cli-benchmark-'));
await mkdir(path.join(directory, '.playwright'));
await mkdir(path.join(directory, 'tmp'));
const config = path.join(directory, '.playwright', 'cli.config.json');
await writeFile(config, JSON.stringify({ browser: { browserName: 'chromium', launchOptions: { headless: true } } }));
const session = 'bench-' + randomUUID();
const env = { ...process.env, NO_UPDATE_NOTIFIER: '1', XDG_CACHE_HOME: path.join(directory, 'cache'), TMPDIR: path.join(directory, 'tmp'), PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), '.cache', 'ms-playwright') };
const fixture = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end('<!doctype html><title>Owned counter</title><button>Add</button><output>0</output><script>let n=0;document.querySelector("button").onclick=()=>document.querySelector("output").textContent=String(++n)</script>');
});
fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
const origin = `http://127.0.0.1:${fixture.address().port}`;
const roots = new Set(); let observing = false; let auditError; let calls = 0; let argumentBytes = 0; let stdoutBytes = 0; let stderrBytes = 0;
async function observe() {
  if (observing) return;
  observing = true;
  try { for (const pid of await ownedDescendants([...roots])) roots.add(pid); }
  catch (error) { auditError ??= error; }
  finally { observing = false; }
}
const timer = setInterval(() => { void observe(); }, 25);
async function command(args) {
  calls++; argumentBytes += Buffer.byteLength(JSON.stringify(args));
  const child = spawn(process.execPath, [entry, '-s=' + session, ...args], { cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000, killSignal: 'SIGTERM' });
  roots.add(child.pid); await observe();
  let stdout = ''; let stderr = '';
  child.stdout.on('data', chunk => { stdoutBytes += chunk.length; stdout = (stdout + chunk).slice(-1048576); });
  child.stderr.on('data', chunk => { stderrBytes += chunk.length; stderr = (stderr + chunk).slice(-1048576); });
  const [code] = await once(child, 'close');
  await observe();
  assert.equal(code, 0, 'Official CLI command failed: ' + stdout + stderr);
  assert.doesNotMatch(stdout, /### Error\b/);
  return stdout;
}
let closed = false; let verified = false; const start = performance.now();
try {
  await command(['open', origin, '--config=' + config, '--idle-timeout=10000']);
  const openedMs = Math.round(performance.now() - start);
  const output = await command(['run-code', `async page => { for(let i=0;i<100;i++) await page.getByRole('button',{name:'Add'}).click(); const count=await page.locator('output').textContent(); if(count!=='100'||page.url()!==${JSON.stringify(origin + '/')}) throw new Error('owned_counter_assertion'); return {ownedCounter:100}; }`]);
  assert.match(output, /"ownedCounter"\s*:\s*100/);
  const executedMs = Math.round(performance.now() - start);
  assert.ok(roots.size >= 5, 'Observer did not capture the detached runtime/browser tree');
  await command(['close']); closed = true;
  const deadline = performance.now() + 15000;
  while ((await ownedDescendants([...roots])).length && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  assert.ifError(auditError);
  assert.deepEqual(await ownedDescendants([...roots]), []);
  verified = true;
  console.log(JSON.stringify({ interface: 'official_playwright_cli_released', cliVersion, driverVersion, node: process.version, os: process.platform, samples: 1, modelTurns: 0, mcpCalls: 0, cliCommands: calls, clicks: 100, domAndUrlVerified: true, openedMs, executedMs, totalWithAuditedShutdownMs: Math.round(performance.now() - start), argumentJsonBytes: argumentBytes, stdoutBytes, stderrBytes, activeOwnedProcesses: 0, note: 'Released alpha driver differs from fork stable1.64.1; bytes are CLI argument JSON/output, not model tokens or wire traffic.' }));
} finally {
  if (!closed) { try { await command(['close']); } catch {} }
  clearInterval(timer);
  while (observing) await new Promise(resolve => setTimeout(resolve, 10));
  fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
  if (verified) await rm(directory, { recursive: true, force: true });
  else console.error('Official CLI fixture retained after failed or uncertain benchmark.');
}
