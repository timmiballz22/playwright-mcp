import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { JobController } from './jobs/controller.mjs';
import { resolveJobConfig } from './jobs/config.mjs';
import { supportsJournal } from './jobs/journal.mjs';

if (supportsJournal) test('durable real HTTP failures preserve status, privacy and deduplication after artifact cleanup', { timeout: 60000 }, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jobs-http-failure-'));
  const canary = 'fake-durable-http-private-canary'; const hits = new Map();
  const fixture = createServer((request, response) => {
    const route = new URL(request.url, 'http://fixture.invalid').pathname;
    hits.set(route, (hits.get(route) ?? 0) + 1);
    const status = [401, 404, 503].includes(Number(route.slice(1))) ? Number(route.slice(1)) : 404;
    response.writeHead(status, { 'Content-Type': 'text/html', 'X-Private': canary });
    response.end('<p>' + canary + '</p>');
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  let controller; let verified = false; let primaryFailure;
  try {
    const config = await resolveJobConfig({ env: { PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(),
      PLAYWRIGHT_JOBS_PROJECT_DIR: root, PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'state'),
      PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: origin } });
    controller = await JobController.open(config);
    for (const [status, code] of [[401, 'http_401'], [404, 'http_404'], [503, 'http_5xx']]) {
      const workflow = { timeoutMs: 10000, steps: [{ type: 'goto', url: origin + '/' + status + '?private=' + canary },
        { type: 'assertText', selector: 'p', equals: canary }] };
      const started = await controller.start(workflow, 'http-' + status);
      let job; const end = performance.now() + 15000;
      do { job = await controller.status(started.jobId); if (['FAILED', 'TIMED_OUT', 'CRASHED', 'CANCELLED', 'SUCCEEDED'].includes(job.state)) break;
        await new Promise(resolve => setTimeout(resolve, 25));
      } while (!t.signal.aborted && performance.now() < end);
      assert.equal(job.state, 'FAILED'); assert.equal(job.completed, 0); assert.equal(job.operatorAttentionRequired, false);
      const result = await controller.result(started.jobId);
      assert.equal(result.reason, 'action_failed'); assert.equal(result.failedStep.error, code);
      assert.equal(result.failedStep.failureKind, 'http_failure'); assert.equal(result.failedStep.httpStatus, status);
      assert.equal(JSON.stringify(result).includes(canary), false);
      assert.equal((await controller.cleanup(started.jobId, false)).removed, true);
      assert.equal((await controller.result(started.jobId)).failedStep.httpStatus, status);
      assert.equal((await controller.start(workflow, 'http-' + status)).jobId, started.jobId);
      assert.equal(hits.get('/' + status), 1, 'Failed HTTP jobs must not replay after artifact cleanup');
    }
    verified = true;
  } catch (error) { primaryFailure = error; throw error; }
  finally {
    let closed = false;
    try { if (controller) assert.equal((await controller.close()).cleanupConfirmed, true); closed = true; }
    catch (error) { if (primaryFailure) throw new AggregateError([primaryFailure, error], 'HTTP job verification and controller close failed', { cause: primaryFailure }); throw error; }
    finally {
      fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
      if (verified && closed) await rm(root, { recursive: true, force: true });
      else console.error('Durable HTTP fixture preserved: acceptance or cleanup not confirmed');
    }
  }
});
