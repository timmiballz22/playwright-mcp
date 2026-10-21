import { ownedDescendants } from './fixtures/process-audit.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';

for (const browser of ['chromium', 'firefox', 'webkit']) {
  test(`supervised ${browser}: real browser deadline closes owned process`, { timeout: 30000 }, async () => {
    const fixture = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><button>Ready</button>');
    });
    fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const dir = await mkdtemp(path.join(os.tmpdir(), 'executor-browser-'));
    const owned = [];
    try {
      const result = await executeWorkflow({ browser, timeoutMs: 10000, actionTimeoutMs: 30000,
        steps: [{ type: 'goto', url: origin }, { type: 'waitFor', selector: '#never' }] }, {
        allowedOrigins: [origin], artifactsDir: dir,
        onEvent: event => { if (event.type === 'ownedProcess') owned.push(event.pid); },
      });
      assert.ok(owned.length, 'No real browser ownership was reported; launch did not succeed');
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'timeout', JSON.stringify(result));
      assert.equal(result.execution.cleanup, 'terminated');
      assert.ok(result.durationMs < 15000);
      assert.equal(result.execution.tempCleanup, 'removed');
      await assert.rejects(stat(path.join(dir, 'exec-' + result.runId, 'tmp')), { code: 'ENOENT' });
      let auditReceipt = null;
      const survivors = await ownedDescendants([result.execution.supervisorPid, result.execution.workerPid, ...owned], {
        onReceipt: receipt => { auditReceipt = receipt; },
      });
      assert.deepEqual(survivors, [], JSON.stringify({ failure: 'owned_process_after_cleanup', audit: auditReceipt,
        supervisorMatched: survivors.includes(result.execution.supervisorPid), workerMatched: survivors.includes(result.execution.workerPid),
        browserRootsMatched: owned.filter(pid => survivors.includes(pid)).length,
        forced: result.execution.forced, cleanup: result.execution.cleanup, tempCleanup: result.execution.tempCleanup }));
      for (const pid of owned) {
        // Zombies have exited and released browser resources; host reaping is
        // separate. Do not count a still-executing process as successful cleanup.
        let running = false;
        try {
          process.kill(pid, 0);
          running = process.platform !== 'linux' || !/\) Z /.test(await readFile(`/proc/${pid}/stat`, 'utf8'));
        } catch {}
        assert.equal(running, false, 'Owned browser remains running');
      }
    } finally {
      fixture.closeAllConnections(); fixture.close(); await rm(dir, { recursive: true, force: true });
    }
  });
}
