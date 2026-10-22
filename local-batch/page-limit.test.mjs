import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLifetimeObserver } from './jobs/fixtures/lifetime-observer.mjs';

for (const browser of (process.env.PLAYWRIGHT_BATCH_TEST_BROWSERS ?? 'chromium,firefox,webkit').split(',')) {
  test(`${browser}: operator page limit stops an approved popup burst without executing the next step`, { timeout: 45000 }, async () => {
    let nextHits = 0; const sinceMs = Date.now();
    let accepted = false; let primary;
    const fixture = createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      // Closure is a browser lifecycle fact, independent of rendered frames.
      // The reuse fixture suppresses RAF so a background-tab observer must
      // still verify child.closed and all three exact DOM transitions.
      if (request.url === '/popup-close') response.end('<!doctype html><script>opener.childStarted(window);window.close()</script>');
      else if (request.url === '/reuse') response.end('<!doctype html><button onclick="document.querySelector(\'output\').id=\'pending\';window.open(\'/popup-close\')">Open and close</button><output>waiting</output><script>window.requestAnimationFrame=()=>0;let n=0;window.childStarted=child=>{const check=()=>{if(child.closed){const output=document.querySelector("output");output.id="closed-"+(++n);output.textContent="closed:"+n}else setTimeout(check, 10)};setTimeout(check, 10)}</script>');
      else if (request.url.startsWith('/popup')) response.end('<!doctype html><script>opener.done()</script>');
      else if (request.url === '/next') { nextHits++; response.end('next'); }
      else response.end('<!doctype html><button onclick="for(let i=0;i<3;i++)window.open(\'/popup?i=\'+i)">Open three</button><output>waiting</output><script>let pending=3;window.done=()=>{if(!--pending){document.querySelector("output").id="ready";document.querySelector("output").textContent="ready"}}</script>');
    });
    fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const directory = await mkdtemp(path.join(os.tmpdir(), 'page-limit-'));
    const observer = await createLifetimeObserver(path.join(directory, 'factory-control'));
    const run = async (workflow, options) => {
      const [outcome] = await observer.run([{ workflow, options }]);
      if (outcome.status === 'rejected') throw outcome.reason;
      return outcome.value;
    };
    const auditOwned = phase => observer.audit('page_limit_' + browser + '_' + phase, sinceMs);
    try {
      for (const maxPages of [4, 2]) {
        const result = await run({ browser, timeoutMs: 15000, steps: [
          { type: 'goto', url: origin }, { type: 'click', selector: 'button' },
          { type: 'waitFor', selector: '#ready' }, { type: 'assertText', selector: 'output', equals: 'ready' },
          { type: 'goto', url: origin + '/next' },
        ] }, { allowedOrigins: [origin], artifactsDir: directory, maxPages });
        assert.equal(result.ok, maxPages === 4, JSON.stringify(result));
        if (maxPages === 2) {
          assert.equal(result.reason, 'resource_limit'); assert.equal(result.retrySafe, false);
          assert.ok(result.completed < 5); assert.equal(result.actionsSucceeded, false);
        } else assert.equal(result.completed, 5);
        assert.equal(nextHits, 1, 'Only the successful positive control may execute the next navigation');
        assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
        await auditOwned(maxPages === 4 ? 'quota_4' : 'quota_2');
      }
      const reuse = await run({ browser, timeoutMs: 15000, steps: [
        { type: 'goto', url: origin + '/reuse' },
        ...[1, 2, 3].flatMap(index => [{ type: 'click', selector: 'button' }, { type: 'waitFor', selector: '#closed-' + index }, { type: 'assertText', selector: 'output', equals: 'closed:' + index }]),
      ] }, { allowedOrigins: [origin], artifactsDir: directory, maxPages: 2 });
      assert.equal(reuse.ok, true, JSON.stringify(reuse)); assert.equal(reuse.completed, 10);
      assert.equal(reuse.execution.cleanup, 'terminated'); assert.equal(reuse.execution.tempCleanup, 'removed');
      assert.equal(nextHits, 1); await auditOwned('reuse');
      accepted = true;
    } catch (error) { primary = error; throw error; }
    finally {
      let clean = false;
      try { await observer.close(); clean = true; }
      catch (error) { if (primary) throw new AggregateError([primary, error], 'Page-limit acceptance and teardown failed'); throw error; }
      finally {
        fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
        if (clean && accepted) await rm(directory, { recursive: true, force: true });
        else console.error('Page-limit fixture workspace preserved: acceptance or cleanup not confirmed');
      }
    }
  });
}
