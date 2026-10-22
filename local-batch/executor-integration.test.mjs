import { createLifetimeObserver } from './jobs/fixtures/lifetime-observer.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

for (const browser of ['chromium', 'firefox', 'webkit']) {
  test(`supervised ${browser}: 20 real clicks, exact counter, PNG and atomic report`, { timeout: 30000 }, async () => {
    const fixture = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><button id="add">Add</button><output>0</output><script>let n=0;document.querySelector("button").onclick=()=>document.querySelector("output").textContent=String(++n)</script>');
    });
    fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const dir = await mkdtemp(path.join(os.tmpdir(), 'supervised-positive-'));
    let admitted = false;
    let browserBeforeAdmission = false;
    let verified = false; let primary;
    const observer = await createLifetimeObserver(path.join(dir, 'factory-control'));
    try {
      const [outcome] = await observer.run([{ workflow: { browser, timeoutMs: 20000, steps: [
        { type: 'goto', url: origin }, { type: 'click', selector: { role: 'button', name: 'Add' }, repeat: 20 },
        { type: 'assertText', selector: 'output', equals: '20' }, { type: 'screenshot' },
      ] }, options: { allowedOrigins: [origin], artifactsDir: dir, allowSensitiveArtifacts: true,
        beforeWorkerStart: async ({ pid }) => { assert.ok(pid > 1); admitted = true; },
        onEvent: event => { if (event.type === 'ownedProcess' && !admitted) browserBeforeAdmission = true; },
      } }]);
      if (outcome.status === 'rejected') throw outcome.reason;
      const result = outcome.value;
      assert.equal(admitted, true);
      assert.equal(browserBeforeAdmission, false);
      assert.equal(result.execution.mode, 'supervised');
      assert.equal(result.execution.cleanup, 'terminated');
      assert.equal(result.execution.tempCleanup, 'removed');
      await assert.rejects(stat(path.join(dir, 'exec-' + result.runId, 'tmp')), { code: 'ENOENT' });
      await observer.audit('supervised_' + browser);
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.completed, 23);
      const report = JSON.parse(await readFile(result.reportPath, 'utf8'));
      assert.equal(report.runId, result.runId);
      assert.equal(report.results.length, 23);
      const png = await readFile(report.results.at(-1).artifact);
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      verified = true;
    } catch (error) { primary = error; throw error;
    } finally {
      let clean = false;
      try { await observer.close(); clean = true; }
      catch (error) { if (primary) throw new AggregateError([primary, error], 'Supervised acceptance and lifetime audit failed'); throw error; }
      finally {
        fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
        if (verified && clean) await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        else console.error('Supervised browser fixture preserved: acceptance or cleanup not confirmed');
      }
    }
  });
}
