import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('local stdio MCP: handshake, tool list, rejection, browser workflow', {
  timeout: 120000,
}, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'batch-mcp-'));
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<button id="click">Click</button><output id="n">0</output><script>let n=0; document.querySelector("#click").onclick=()=>{document.querySelector("#n").textContent=String(++n)}</script>');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, 'local-batch/mcp.mjs')],
    cwd: root,
    env: { ...process.env, PLAYWRIGHT_BATCH_ALLOW_SENSITIVE_ARTIFACTS: '1', PLAYWRIGHT_BATCH_ARTIFACTS_DIR: dir, PLAYWRIGHT_BATCH_ALLOWED_ORIGINS: new URL(url).origin },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'local-batch-verification', version: '1.0.0' });
  try {
    await client.connect(transport);
    await client.ping();
    const discovery = await client.listTools();
    assert.ok(discovery.tools.some(t => t.name === 'browser_run_batch'));
    const denied = await client.callTool({
      name: 'browser_run_batch',
      arguments: { steps: [{ type: 'goto', url: 'https://not-allowed.invalid/' }] },
    });
    assert.equal(denied.isError, true);
    const response = await client.callTool({
      name: 'browser_run_batch',
      arguments: { steps: [
        { type: 'goto', url },
        { type: 'click', selector: { role: 'button', name: 'Click' }, repeat: 997 },
        { type: 'assertText', selector: '#n', equals: '997' },
        { type: 'screenshot' },
      ] },
    }, undefined, { timeout: 120000 });
    assert.equal(response.isError, false, JSON.stringify(response).slice(0, 1500));
    const summary = JSON.parse(response.content[0].text);
    assert.equal(summary.ok, true);
    assert.equal(summary.completed, 1000);
    assert.ok(summary.reportPath.startsWith(dir));
    assert.equal(summary.recentSteps.length, 10);
    const detail = JSON.parse(await readFile(summary.reportPath, 'utf8'));
    assert.equal(detail.results.length, 1000);
    assert.equal(detail.results.at(-1).type, 'screenshot');
  } finally {
    await client.close().catch(() => {});
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
