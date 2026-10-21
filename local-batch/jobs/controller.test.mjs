import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { JobController } from './controller.mjs';
import { supportsJournal } from './journal.mjs';
import { ownedDescendants } from '../fixtures/process-audit.mjs';
const workflow = { timeoutMs: 15000, steps: [{ type: 'click', selector: 'fake-controller-private-canary' }] };
async function waitFor(controller, id, state) {
  const deadline = performance.now() + 12000;
  do {
    const row = await controller.status(id);
    if ((Array.isArray(state) ? state : [state]).includes(row.state)) return row;
    await new Promise(resolve => setTimeout(resolve, 25));
  } while (performance.now() < deadline);
  assert.fail('Expected bounded controller state: ' + state);
}
if (supportsJournal) for (const mode of ['queue-success', 'cancel-and-reconnect', 'queue-pressure', 'queue-expiry', 'guardian-crash', 'close-before-dequeue', 'cancel-during-guardian-start']) {
  test(`internal job controller ${mode}`, { timeout: 45000 }, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'controller-'));
    const owned = []; let cancelError; let controller; let observer; let cleanupConfirmed = false;
    const config = { journal: { directory: path.join(root, 'journal'), projectId: 'c'.repeat(64), ownerId: 'controller-fixture' },
      execution: { artifactsDir: path.join(root, 'artifacts'), workerModule: new URL(mode === 'queue-success' ? '../fixtures/cleanup-success-worker.mjs' : '../fixtures/hang-worker.mjs', import.meta.url).href },
      onEvent: event => {
        if (event.pid) owned.push(event.pid);
        if (mode === 'cancel-during-guardian-start' && event.type === 'guardianSpawned') {
          void controller.cancel(event.jobId).catch(error => { cancelError = error; });
          controller.active.child.kill('SIGKILL');
        }
      } };
    try {
      controller = await JobController.open(config);
      if (mode === 'cancel-during-guardian-start') {
        const first = await controller.start(workflow, 'request-1');
        const stopped = await waitFor(controller, first.jobId, ['CANCELLED', 'FAILED']);
        assert.equal(cancelError, undefined);
        assert.equal(stopped.state, 'CANCELLED'); assert.equal(stopped.completed, 0);
        assert.equal(stopped.completionCertainty, 'exact');
        assert.equal(stopped.operatorAttentionRequired, false);
        return;
      }
      if (mode === 'close-before-dequeue') {
        const first = await controller.start(workflow, 'request-1');
        const stopped = await controller.close(); cleanupConfirmed = stopped.cleanupConfirmed;
        assert.equal(cleanupConfirmed, true);
        assert.deepEqual(await controller.close(), stopped);
        await assert.rejects(controller.start(workflow, 'after-close'), { code: 'controller_closed' });
        controller = undefined;
        observer = await JobController.open(config);
        const row = await observer.status(first.jobId);
        assert.equal(row.state, 'CANCELLED'); assert.equal(row.completed, 0);
        assert.equal(row.completionCertainty, 'exact');
        assert.equal(owned.length, 0);
        return;
      }
      const [first, duplicate] = await Promise.all([controller.start(workflow, 'request-1'), controller.start(workflow, 'request-1')]);
      assert.equal(first.jobId, duplicate.jobId);
      await assert.rejects(controller.start({ ...workflow, steps: [{ type: 'click', selector: 'different' }] }, 'request-1'), { code: 'idempotency_conflict' });
      if (mode === 'queue-success') {
        const second = await controller.start(workflow, 'request-2');
        for (const row of [first, second]) {
          await waitFor(controller, row.jobId, 'SUCCEEDED');
          assert.equal((await controller.result(row.jobId)).completed, 1);
        }
        assert.equal(owned.filter(pid => pid > 0).length > 1, true);
      } else {
        await waitFor(controller, first.jobId, 'RUNNING');
        if (mode === 'guardian-crash') {
          const end = performance.now() + 5000;
          while (owned.length < 4 && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 25));
          assert.ok(owned.length >= 4, 'Owned worker effects were not observed');
          controller.active.child.kill('SIGKILL');
          const crashed = await waitFor(controller, first.jobId, 'CRASHED');
          assert.equal(crashed.operatorAttentionRequired, true);
          await assert.rejects(controller.start(workflow, 'after-crash'), { code: 'cleanup_blocked' });
          return;
        }
        const queued = await controller.start(mode === 'queue-expiry' ? { ...workflow, timeoutMs: 100 } : workflow, 'request-2');
        assert.equal(queued.state, 'QUEUED');
        if (mode === 'queue-expiry') {
          const expired = await waitFor(controller, queued.jobId, 'TIMED_OUT');
          assert.equal(expired.completed, 0); assert.equal(expired.completionCertainty, 'exact');
        } else if (mode === 'queue-pressure') {
          for (let i = 3; i <= 9; i++) await controller.start(workflow, 'request-' + i);
          await assert.rejects(controller.start(workflow, 'request-10'), { code: 'queue_full' });
          const competing = await JobController.open(config);
          try {
            await competing.cancel(queued.jobId);
            // Another client freed a journal slot, but this controller still
            // owns the queued payload until its active guardian finishes.
            await assert.rejects(controller.start(workflow, 'request-11'), { code: 'queue_full' });
            assert.equal((await controller.start(workflow, 'request-1')).jobId, first.jobId);
          } finally { await competing.close(); }
        } else {
          const cancelled = await controller.cancel(queued.jobId);
          assert.equal(cancelled.state, 'CANCELLED'); assert.equal(cancelled.completed, 0);
          assert.equal((await controller.cancel(queued.jobId)).state, 'CANCELLED');
        }
        const stopped = await controller.close(); cleanupConfirmed = stopped.cleanupConfirmed;
        assert.equal(cleanupConfirmed, true);
        controller = undefined;
        observer = await JobController.open(config);
        const previous = await observer.status(first.jobId);
        assert.equal(previous.state, 'CANCELLED');
        assert.equal((await observer.start(workflow, 'request-1')).jobId, first.jobId);
        const foreign = await JobController.open({ ...config, journal: { ...config.journal, ownerId: 'other-owner' } });
        try { await assert.rejects(foreign.status(first.jobId), { code: 'not_found' }); }
        finally { await foreign.close(); }
      }
      const rows = await (controller ?? observer).list(20);
      assert.equal(JSON.stringify(rows).includes('fake-controller-private-canary'), false);
    } finally {
      if (controller) cleanupConfirmed = (await controller.close()).cleanupConfirmed;
      if (observer) cleanupConfirmed = (await observer.close()).cleanupConfirmed && cleanupConfirmed;
      const auditEnd = performance.now() + 10000;
      while ((await ownedDescendants(owned)).length && performance.now() < auditEnd) await new Promise(resolve => setTimeout(resolve, 50));
      assert.deepEqual(await ownedDescendants(owned), []);
      if (cleanupConfirmed) await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
}
