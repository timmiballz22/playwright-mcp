import { ownedDescendants } from './fixtures/process-audit.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';

for (const browser of ['chromium', 'firefox', 'webkit']) {
  test(`supervised ${browser}: 20 real clicks, exact counter, PNG and atomic report`, { timeout: 30000 }, async () => {
    const fixture = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><button id="add">Add</button><output>0</output><script>let n=0;document.querySelector("button").onclick=()=>document.querySelector("output").textContent=String(++n)</script>');
    });
    fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const dir = await mkdtemp(path.join(os.tmpdir(), 'supervised-positive-'));
    try {
      const result = await executeWorkflow({ browser, timeoutMs: 20000, steps: [
        { type: 'goto', url: origin }, { type: 'click', selector: { role: 'button', name: 'Add' }, repeat: 20 },
        { type: 'assertText', selector: 'output', equals: '20' }, { type: 'screenshot' },
      ] }, { allowedOrigins: [origin], artifactsDir: dir, allowSensitiveArtifacts: true });
      assert.equal(result.execution.mode, 'supervised');
      assert.equal(result.execution.cleanup, 'terminated');
      assert.equal(result.execution.tempCleanup, 'removed');
      await assert.rejects(stat(path.join(dir, 'exec-' + result.runId, 'tmp')), { code: 'ENOENT' });
      assert.deepEqual(await ownedDescendants([result.execution.supervisorPid, result.execution.workerPid, ...result.execution.browserPids]), [], 'Owned descendant processes remain after execution');
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.completed, 23);
      const report = JSON.parse(await readFile(result.reportPath, 'utf8'));
      assert.equal(report.runId, result.runId);
      assert.equal(report.results.length, 23);
      const png = await readFile(report.results.at(-1).artifact);
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    } finally {
      fixture.closeAllConnections(); fixture.close();
      await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
}
