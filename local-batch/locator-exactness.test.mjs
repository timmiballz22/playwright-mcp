import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLifetimeObserver } from './jobs/fixtures/lifetime-observer.mjs';

const selectors = ['.owned', { role: 'button', name: 'Shared' }, { testId: 'shared' },
  { label: 'Shared' }, { placeholder: 'Shared' }, { text: 'Shared' }];

for (const browser of (process.env.PLAYWRIGHT_BATCH_TEST_BROWSERS ?? 'chromium,firefox,webkit').split(',')) {
  test(`supervised ${browser}: six locator forms are exact and ambiguity never selects a first match`, { timeout: 120000 }, async () => {
    const hits = { effect: 0, wrong: 0, after: 0 };
    const fixture = createServer((request, response) => {
      const route = new URL(request.url, 'http://fixture.invalid').pathname;
      const key = route.slice(1);
      if (Object.hasOwn(hits, key)) {
        hits[key]++; response.writeHead(200); response.end('owned effect'); return;
      }
      const button = '<input type="button" class="owned" aria-label="Shared" data-testid="shared" placeholder="Shared" value="Shared" onclick="act()">';
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><title>Owned locator fixture</title>${button}${route === '/duplicate' ? button :
        '<input type="button" aria-label="Shared extra" data-testid="shared-extra" placeholder="Shared extra" value="Shared extra" onclick="fetch(\'/wrong\')">'}
        <output id="ack-0">0</output><script>let n=0;function act(){const value=++n;fetch('/effect').then(()=>{const out=document.querySelector('output');out.id='ack-'+value;out.textContent=String(value)})}</script>`);
    });
    fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const directory = await mkdtemp(path.join(os.tmpdir(), 'locator-exactness-'));
    const observer = await createLifetimeObserver(path.join(directory, 'factory-control'));
    let verified = false; let primary;
    const run = async steps => {
      const [outcome] = await observer.run([{ workflow: { browser, timeoutMs: 10000, actionTimeoutMs: 3000, steps },
        options: { allowedOrigins: [origin], artifactsDir: directory } }]);
      if (outcome.status === 'rejected') throw outcome.reason;
      const result = outcome.value;
      assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
      return result;
    };
    try {
      const steps = [{ type: 'goto', url: origin }];
      for (const [index, selector] of selectors.entries()) steps.push(
          { type: 'click', selector }, { type: 'waitFor', selector: '#ack-' + (index + 1) },
          { type: 'assertText', selector: 'output', equals: String(index + 1) });
      const positive = await run(steps);
      assert.equal(positive.ok, true, JSON.stringify(positive)); assert.equal(positive.completed, steps.length);
      assert.deepEqual(hits, { effect: 6, wrong: 0, after: 0 });
      for (const selector of selectors) {
        const result = await run([{ type: 'goto', url: origin + '/duplicate' }, { type: 'click', selector },
          { type: 'goto', url: origin + '/after' }]);
        assert.equal(result.ok, false); assert.equal(result.reason, 'action_failed'); assert.equal(result.completed, 1);
        assert.equal(result.failedStep.index, 2); assert.equal(result.failedStep.failureKind, 'ambiguous_locator');
        assert.equal(result.retrySafe, false);
        assert.deepEqual(hits, { effect: 6, wrong: 0, after: 0 }, 'Ambiguity must have no input effect, fallback, retry or next-step navigation');
      }
      await observer.audit('locator_exactness_' + browser); verified = true;
      console.log(JSON.stringify({ fixture: 'locator_exactness', browser, forms: selectors.length,
        positiveCompleted: positive.completed, ambiguousRefusals: selectors.length, ...hits }));
    } catch (error) { primary = error; throw error; }
    finally {
      let clean = false;
      try { await observer.close(); clean = true; }
      catch (error) { if (primary) throw new AggregateError([primary, error], 'Locator acceptance and lifetime audit failed'); throw error; }
      finally {
        fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
        if (verified && clean) await rm(directory, { recursive: true, force: true });
        else console.error('Locator fixture preserved: acceptance or cleanup not confirmed');
      }
    }
  });
}
