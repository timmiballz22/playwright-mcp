// Run from source against an independently installed production tarball.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const target = path.resolve(process.argv[2]);
const dir = await mkdtemp(path.join(os.tmpdir(), 'production-smoke-'));
const throttleHits = new Map();
let afterLimitHits = 0;
const fixture = createServer((req, res) => {
  if (req.url === '/popup-source') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<button onclick="window.open(\'/popup-child\')">Open popup</button>'); return; }
  if (req.url === '/after-limit') afterLimitHits++;
  if (req.url === '/throttle' || req.url === '/cli-throttle') {
    throttleHits.set(req.url, (throttleHits.get(req.url) || 0) + 1);
    if (throttleHits.get(req.url) === 1) {
      res.writeHead(503, { 'Retry-After': '0' }); res.end('canary-production-throttle'); return;
    }
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<title>Production Fixture</title><button>Add</button><output>0</output><script>let n=0;document.querySelector("button").onclick=()=>{document.querySelector("output").textContent=String(++n)}</script>');
});
fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
const origin = `http://127.0.0.1:${fixture.address().port}`;
const limitedWorkflow = { timeoutMs: 20000, steps: [{ type: 'goto', url: origin + '/popup-source' }, { type: 'click', selector: 'button' }, { type: 'waitFor', selector: '#never' }, { type: 'goto', url: origin + '/after-limit' }] };
try {
  for (const entry of ['cli.js', 'local-batch/mcp.mjs']) {
    const original = entry === 'cli.js';
    const client = new Client({ name: 'production-smoke', version: '1.0.0' });
    const transport = new StdioClientTransport({ command: process.execPath,
      args: [path.join(target, entry), ...(original ? ['--browser=chromium', '--isolated', '--headless'] : [])],
      cwd: target, stderr: 'pipe', env: { ...process.env, PLAYWRIGHT_BATCH_ALLOWED_ORIGINS: origin, PLAYWRIGHT_BATCH_ARTIFACTS_DIR: dir, ...(!original ? { PLAYWRIGHT_BATCH_NAVIGATION_RETRIES: '1', PLAYWRIGHT_BATCH_MAX_PAGES: '1' } : {}) },
    });
    try {
      await client.connect(transport); await client.ping();
      const { tools } = await client.listTools();
      assert.ok(tools.some(t => t.name === (original ? 'browser_navigate' : 'browser_run_batch')));
      const response = await client.callTool({ name: original ? 'browser_navigate' : 'browser_run_batch', arguments: original ? { url: origin } : {
        schemaVersion: 1, steps: [{ type: 'goto', url: origin + '/throttle' }, { type: 'click', selector: { role: 'button', name: 'Add' }, repeat: 3 }, { type: 'assertText', selector: 'output', equals: '3' }],
      } });
      assert.notEqual(response.isError, true, JSON.stringify(response));
      if (original) {
        assert.ok(JSON.stringify(response.content).includes('Production Fixture'));
        await client.callTool({ name: 'browser_close', arguments: {} });
      } else {
        const summary = JSON.parse(response.content[0].text);
        assert.equal(summary.completed, 5);
        assert.equal(throttleHits.get('/throttle'), 2);
        assert.equal(JSON.stringify(summary).includes('canary-production-throttle'), false);
        assert.equal(summary.execution.mode, 'supervised');
        assert.equal(summary.execution.cleanup, 'terminated');
        assert.equal(JSON.parse(await readFile(summary.reportPath, 'utf8')).results.length, 5);
        const limited = await client.callTool({ name: 'browser_run_batch', arguments: limitedWorkflow });
        assert.equal(limited.isError, true);
        const failed = JSON.parse(limited.content[0].text);
        assert.equal(failed.reason, 'resource_limit'); assert.equal(failed.actionsSucceeded, false);
        assert.equal(failed.execution.cleanup, 'terminated'); assert.equal(failed.execution.tempCleanup, 'removed');
        assert.equal(afterLimitHits, 0);
      }
      console.log(JSON.stringify({ entry, handshake: true, toolCount: tools.length, realBrowser: true, ...(!original ? { pageLimit: true } : {}), production: true }));
    } finally { await client.close(); }
  }
  const workflowFile = path.join(dir, 'cli-workflow.json');
  await writeFile(workflowFile, JSON.stringify({ steps: [{ type: 'goto', url: origin + '/cli-throttle' }] }));
  const { stdout } = await promisify(execFile)(process.execPath, [path.join(target, 'local-batch/cli.mjs'),
    '--workflow', workflowFile, '--allow-origin', origin, '--artifacts', dir, '--navigation-retries', '1', '--max-pages', '1'], { timeout: 15000 });
  const cliResult = JSON.parse(stdout);
  assert.equal(cliResult.ok, true); assert.equal(cliResult.completed, 1);
  assert.equal(throttleHits.get('/cli-throttle'), 2);
  assert.equal(cliResult.execution.cleanup, 'terminated');
  await writeFile(workflowFile, JSON.stringify(limitedWorkflow));
  let failure;
  try { await promisify(execFile)(process.execPath, [path.join(target, 'local-batch/cli.mjs'), '--workflow', workflowFile, '--allow-origin', origin, '--artifacts', dir, '--max-pages', '1'], { timeout: 25000 }); }
  catch (error) { assert.equal(error.code, 1); failure = JSON.parse(error.stdout); }
  assert.equal(failure?.reason, 'resource_limit'); assert.equal(failure.actionsSucceeded, false);
  assert.equal(failure.execution.cleanup, 'terminated'); assert.equal(failure.execution.tempCleanup, 'removed');
  assert.equal(afterLimitHits, 0);
  console.log(JSON.stringify({ entry: 'local-batch/cli.mjs', realBrowser: true, navigationRetry: true, pageLimit: true, production: true }));
} finally { fixture.closeAllConnections(); fixture.close(); await rm(dir, { recursive: true, force: true }); }
