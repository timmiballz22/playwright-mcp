import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runWorkflow } from './runner.mjs';

for (const browser of ['chromium', 'firefox', 'webkit']) {
  const clicks = browser === 'chromium' ? 997 : 20;
  test(`real ${browser}: navigation, ${clicks} clicks, assertion, screenshot, cleanup`, {
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
    let diagnostic;
    try {
      const steps = [{ type: 'goto', url: origin + '/' },
        ...Array.from({ length: clicks }, () => ({ type: 'click', selector: { role: 'button', name: 'Add' } })),
        { type: 'assertText', selector: '#count', equals: String(clicks) },
        { type: 'screenshot' }];
      const result = await runWorkflow({ browser, schemaVersion: 1, steps, timeoutMs: 120000 },
        { artifactsDir: dir, allowedOrigins: [origin], allowSensitiveArtifacts: true,
          // This fixture has only static local data and no credentials. Raw call
          // logs stay in trusted test diagnostics, outside model-visible results.
          onActionFailure: (error, step) => { diagnostic = { ...step, name: error?.name, fixtureCallLog: String(error?.message).slice(-5000) }; },
        });
      assert.equal(result.ok, true, JSON.stringify({ result, diagnostic }).slice(-6500));
      assert.equal(result.completed, clicks + 3);
      assert.ok((await stat(result.results.at(-1).artifact)).size > 0);
    } finally {
      server.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

}
