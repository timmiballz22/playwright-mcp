import { createLifetimeObserver } from './jobs/fixtures/lifetime-observer.mjs';
import { stepFailureDiagnostic } from '../scripts/step-failure-diagnostic.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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
    let verified = false;
    const observer = await createLifetimeObserver(path.join(dir, 'factory-control'));
    let primary;
    try {
      const [outcome] = await observer.run([{ workflow: { browser, timeoutMs: 10000, actionTimeoutMs: 30000,
        steps: [{ type: 'goto', url: origin }, { type: 'waitFor', selector: '#never' }] }, options: {
        allowedOrigins: [origin], artifactsDir: dir,
        onEvent: event => { if (event.type === 'ownedProcess') owned.push(event.pid); },
      } }]);
      if (outcome.status === 'rejected') throw outcome.reason;
      const result = outcome.value;
      assert.ok(owned.length, JSON.stringify({ failure: 'browser_launch_not_observed', reason: result.reason,
        completed: result.completed, failedStep: stepFailureDiagnostic(result.failedStep), durationMs: result.durationMs,
        executionMode: result.execution?.mode, forced: result.execution?.forced, cleanup: result.execution?.cleanup,
        tempCleanup: result.execution?.tempCleanup, workerCleanupFailed: result.execution?.workerCleanupFailed }));
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'timeout', JSON.stringify(result));
      assert.equal(result.execution.cleanup, 'terminated');
      assert.ok(result.durationMs < 15000);
      assert.equal(result.execution.tempCleanup, 'removed');
      await assert.rejects(stat(path.join(dir, 'exec-' + result.runId, 'tmp')), { code: 'ENOENT' });
      const audit = await observer.audit('deadline_' + browser);
      // Keep the legacy zero-candidate assertion in addition to scoped identity
      // checks. Full same-snapshot candidates/rows/rootRows stay in the receipt;
      // actual pre-effect births improve future evidence, not old classification.
      const survivors = audit.legacy?.observed ?? audit.observed;
      assert.deepEqual(survivors, [], JSON.stringify({ failure: 'owned_process_after_cleanup', audit: audit.receipt,
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
      verified = true;
    } catch (error) { primary = error; throw error; }
    finally {
      let clean = false;
      try { await observer.close(); clean = true; }
      catch (error) { if (primary) throw new AggregateError([primary, error], 'Deadline fixture and lifetime audit failed'); throw error; }
      finally {
        fixture.closeAllConnections(); fixture.close();
        if (verified && clean) await rm(dir, { recursive: true, force: true });
        else console.error('Deadline fixture workspace preserved: acceptance or cleanup not confirmed');
      }
    }
  });
}
