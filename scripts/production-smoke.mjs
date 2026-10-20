// Run from source against an independently installed production tarball.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const target = path.resolve(process.argv[2]);
const dir = await mkdtemp(path.join(os.tmpdir(), 'production-smoke-'));
const fixture = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<title>Production Fixture</title><button>Add</button><output>0</output><script>let n=0;document.querySelector("button").onclick=()=>{document.querySelector("output").textContent=String(++n)}</script>');
});
fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
const origin = `http://127.0.0.1:${fixture.address().port}`;
try {
  for (const entry of ['cli.js', 'local-batch/mcp.mjs']) {
    const original = entry === 'cli.js';
    const client = new Client({ name: 'production-smoke', version: '1.0.0' });
    const transport = new StdioClientTransport({ command: process.execPath,
      args: [path.join(target, entry), ...(original ? ['--browser=chromium', '--isolated', '--headless'] : [])],
      cwd: target, stderr: 'pipe', env: { ...process.env, PLAYWRIGHT_BATCH_ALLOWED_ORIGINS: origin, PLAYWRIGHT_BATCH_ARTIFACTS_DIR: dir },
    });
    try {
      await client.connect(transport); await client.ping();
      const { tools } = await client.listTools();
      assert.ok(tools.some(t => t.name === (original ? 'browser_navigate' : 'browser_run_batch')));
      const response = await client.callTool({ name: original ? 'browser_navigate' : 'browser_run_batch', arguments: original ? { url: origin } : {
        schemaVersion: 1, steps: [{ type: 'goto', url: origin }, { type: 'click', selector: { role: 'button', name: 'Add' }, repeat: 3 }, { type: 'assertText', selector: 'output', equals: '3' }],
      } });
      assert.notEqual(response.isError, true, JSON.stringify(response));
      if (original) {
        assert.ok(JSON.stringify(response.content).includes('Production Fixture'));
        await client.callTool({ name: 'browser_close', arguments: {} });
      } else {
        const summary = JSON.parse(response.content[0].text);
        assert.equal(summary.completed, 5);
        assert.equal(summary.execution.mode, 'supervised');
        assert.equal(summary.execution.cleanup, 'terminated');
        assert.equal(JSON.parse(await readFile(summary.reportPath, 'utf8')).results.length, 5);
      }
      console.log(JSON.stringify({ entry, handshake: true, toolCount: tools.length, realBrowser: true, production: true }));
    } finally { await client.close(); }
  }
} finally { fixture.closeAllConnections(); fixture.close(); await rm(dir, { recursive: true, force: true }); }
