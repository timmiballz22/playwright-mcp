import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runWorkflow } from './runner.mjs';

test('real Chromium: navigation, 997 clicks / 1,000 actions, assertion, screenshot, cleanup', {
  skip: process.env.RUN_BROWSER_TESTS !== '1' ? 'Set RUN_BROWSER_TESTS=1 with Playwright installed' : false,
}, async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>Local Fixture</title><button id="add">Add</button><output id="count">0</output><script>let n=0;document.querySelector("#add").onclick=()=>{document.querySelector("#count").textContent=String(++n)}</script>');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const dir = await mkdtemp(path.join(os.tmpdir(), 'pw-batch-'));
  try {
    const steps = [{ type: 'goto', url: origin + '/' },
      ...Array.from({ length: 997 }, () => ({ type: 'click', selector: { role: 'button', name: 'Add' } })),
      { type: 'assertText', selector: '#count', contains: '997' },
      { type: 'screenshot' }];
    const result = await runWorkflow({ steps, timeoutMs: 120000 },
      { artifactsDir: dir, allowedOrigins: [origin], allowSensitiveArtifacts: true });
    assert.equal(result.ok, true, JSON.stringify(result).slice(-1500));
    assert.equal(result.completed, 1000);
    assert.ok((await stat(result.results.at(-1).artifact)).size > 0);
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
