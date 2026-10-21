import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';

for (const browser of (process.env.PLAYWRIGHT_BATCH_TEST_BROWSERS ?? 'chromium,firefox,webkit').split(',')) {
  test(`${browser}: operator page limit stops an approved popup burst without executing the next step`, { timeout: 45000 }, async () => {
    let nextHits = 0; const owned = [];
    const fixture = createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      if (request.url.startsWith('/popup')) response.end('<!doctype html><script>opener.done()</script>');
      else if (request.url === '/next') { nextHits++; response.end('next'); }
      else response.end('<!doctype html><button onclick="for(let i=0;i<3;i++)window.open(\'/popup?i=\'+i)">Open three</button><output>waiting</output><script>let pending=3;window.done=()=>{if(!--pending){document.querySelector("output").id="ready";document.querySelector("output").textContent="ready"}}</script>');
    });
    fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const directory = await mkdtemp(path.join(os.tmpdir(), 'page-limit-'));
    try {
      for (const maxPages of [4, 2]) {
        const result = await executeWorkflow({ browser, timeoutMs: 15000, steps: [
          { type: 'goto', url: origin }, { type: 'click', selector: 'button' },
          { type: 'waitFor', selector: '#ready' }, { type: 'assertText', selector: 'output', equals: 'ready' },
          { type: 'goto', url: origin + '/next' },
        ] }, { allowedOrigins: [origin], artifactsDir: directory, maxPages,
          onEvent: event => { if (event.pid) owned.push(event.pid); },
        });
        assert.equal(result.ok, maxPages === 4, JSON.stringify(result));
        if (maxPages === 2) {
          assert.equal(result.reason, 'resource_limit'); assert.equal(result.retrySafe, false);
          assert.ok(result.completed < 5); assert.equal(result.actionsSucceeded, false);
        } else assert.equal(result.completed, 5);
        assert.equal(nextHits, 1, 'Only the successful positive control may execute the next navigation');
        assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
        assert.deepEqual(await ownedDescendants(owned), []);
      }
    } finally {
      let clean = false;
      try { assert.deepEqual(await ownedDescendants(owned), []); clean = true; }
      finally { fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve)); if (clean) await rm(directory, { recursive: true, force: true }); }
    }
  });
}
