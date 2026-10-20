import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function alive(pid) {
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux' && /\) Z /.test(await readFile(`/proc/${pid}/stat`, 'utf8'))) return false;
    return true;
  } catch { return false; }
}
async function assertStopped(pids) {
  for (let i = 0; i < 40; i++) {
    if (!(await Promise.all(pids.map(alive))).some(Boolean)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail('An execution-owned process is still running');
}

for (const mode of ['hang', 'report-stall', 'crash']) {
  test(`supervised ${mode}: bounded completion and owned process cleanup`, { timeout: 15000 }, async () => {
    const { executeWorkflow } = await import('./executor.mjs');
    const observed = [];
    const unrelated = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    try {
      const start = performance.now();
      const result = await executeWorkflow({ timeoutMs: 2000, steps: [{ type: 'click', selector: 'button' }] }, {
        workerModule: new URL(`./fixtures/${mode}-worker.mjs`, import.meta.url),
        onEvent: event => { if (event.pid) observed.push(event.pid); },
      });
      assert.equal(result.ok, false);
      assert.equal(result.reason, mode === 'crash' ? 'worker_crashed' : 'timeout');
      assert.ok(performance.now() - start < 7000, 'Full execution did not finish within its bounded teardown ceiling');
      assert.ok(observed.length >= 2, 'Worker and child ownership were not observed');
      await assertStopped(observed);
      assert.equal(await alive(unrelated.pid), true, 'Termination touched an unrelated sibling process');
    } finally { unrelated.kill('SIGKILL'); }
  });
}

test('pre-cancelled execution never starts a worker', async () => {
  const { executeWorkflow } = await import('./executor.mjs');
  const controller = new AbortController(); controller.abort();
  const events = [];
  const result = await executeWorkflow({ steps: [{ type: 'click', selector: 'button' }] }, { signal: controller.signal, onEvent: event => events.push(event) });
  assert.equal(result.reason, 'cancelled');
  assert.equal(events.length, 0);
});

test('cancel interrupts a worker that cannot service its abort listener', { timeout: 15000 }, async () => {
  const { executeWorkflow } = await import('./executor.mjs');
  const controller = new AbortController();
  const observed = [];
  const result = await executeWorkflow({ timeoutMs: 10000, steps: [{ type: 'click', selector: 'button' }] }, {
    workerModule: new URL('./fixtures/hang-worker.mjs', import.meta.url), signal: controller.signal,
    onEvent: event => { if (event.pid) observed.push(event.pid); if (event.type === 'ownedProcess') controller.abort(); },
  });
  assert.equal(result.reason, 'cancelled');
  await assertStopped(observed);
});

test('supervisor crash cannot strand its worker or detached child', { timeout: 15000 }, async () => {
  const { executeWorkflow } = await import('./executor.mjs');
  const observed = [];
  let supervisor;
  const result = await executeWorkflow({ timeoutMs: 5000, steps: [{ type: 'click', selector: 'button' }] }, {
    workerModule: new URL('./fixtures/hang-worker.mjs', import.meta.url),
    onEvent: event => {
      if (event.pid) observed.push(event.pid);
      if (event.type === 'supervisorSpawned') supervisor = event.pid;
      if (event.type === 'ownedProcess') process.kill(supervisor, 'SIGKILL');
    },
  });
  assert.equal(result.reason, 'supervisor_failed');
  await assertStopped(observed);
});

test('cancellation between precheck and supervisor startup does not start a worker', { timeout: 10000 }, async () => {
  const { executeWorkflow } = await import('./executor.mjs');
  const controller = new AbortController();
  const events = [];
  const result = await executeWorkflow({ timeoutMs: 5000, steps: [{ type: 'click', selector: 'button' }] }, {
    signal: controller.signal, workerModule: new URL('./fixtures/hang-worker.mjs', import.meta.url),
    onEvent: event => { events.push(event); if (event.type === 'supervisorSpawned') controller.abort(); },
  });
  assert.equal(result.reason, 'cancelled');
  assert.equal(events.some(event => event.type === 'workerSpawned'), false, 'Cancellation was checked after work was already started');
});

test('safe failure and lower-bound progress survive supervisor death without raw diagnostics', { timeout: 15000 }, async () => {
  const { executeWorkflow } = await import('./executor.mjs');
  const observed = [];
  let supervisor;
  const result = await executeWorkflow({ timeoutMs: 10000, steps: [{ type: 'click', selector: 'button', repeat: 4 }] }, {
    workerModule: new URL('./fixtures/failure-stall-worker.mjs', import.meta.url),
    onEvent: event => {
      if (event.pid) observed.push(event.pid);
      if (event.type === 'supervisorSpawned') supervisor = event.pid;
      if (event.type === 'actionFailure') process.kill(supervisor, 'SIGKILL');
    },
  });
  assert.equal(result.reason, 'supervisor_failed');
  assert.equal(result.completed, 3);
  assert.deepEqual(result.failedStep, { index: 4, type: 'click', ok: false, error: 'action_failed', failureKind: 'not_stable' });
  assert.equal(JSON.stringify(result).includes('fake-worker-diagnostic-canary'), false);
  await assertStopped(observed);
});

for (const mode of ['success', 'blocked', 'action']) {
  test(`verified cleanup recovery preserves ${mode} action outcome`, { timeout: 15000 }, async () => {
    const { executeWorkflow } = await import('./executor.mjs');
    const observed = [];
    const directory = await mkdtemp(path.join(os.tmpdir(), 'cleanup-outcome-'));
    try {
      const result = await executeWorkflow({ timeoutMs: 10000, steps: [{ type: 'click', selector: 'button' }] }, {
        artifactsDir: directory,
        workerModule: new URL('./fixtures/cleanup-' + mode + '-worker.mjs', import.meta.url),
        onEvent: event => { if (event.pid) observed.push(event.pid); },
      });
      await assertStopped(observed);
      assert.equal(result.execution.cleanup, 'terminated');
      assert.equal(result.execution.workerCleanupFailed, true);
      assert.equal(result.execution.tempCleanup, 'removed');
      assert.equal(result.ok, mode === 'success');
      assert.equal(result.reason, mode === 'blocked' ? 'policy_blocked' : mode === 'action' ? 'action_failed' : null);
      assert.equal(result.completed, mode === 'action' ? 0 : 1);
    } finally { await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });
}

test('failed durable admission cannot start worker actions', { timeout: 15000 }, async () => {
  const { executeWorkflow } = await import('./executor.mjs');
  const events = [];
  let admittedPid;
  const result = await executeWorkflow({ timeoutMs: 3000, steps: [{ type: 'click', selector: 'button' }] }, {
    workerModule: new URL('./fixtures/hang-worker.mjs', import.meta.url),
    beforeWorkerStart: async ({ pid }) => { admittedPid = pid; throw new Error('fake-private-journal-failure'); },
    onEvent: event => events.push(event),
  });
  assert.equal(result.reason, 'journal_unavailable');
  assert.equal(result.completionCertainty, 'exact');
  assert.ok(admittedPid > 1);
  assert.equal(result.completed, 0);
  assert.equal(events.some(event => event.type === 'ownedProcess'), false);
  assert.equal(JSON.stringify(result).includes('fake-private-journal-failure'), false);
  await assertStopped(events.filter(event => event.pid).map(event => event.pid));
});

test('stalled durable admission cannot evade watchdog deadline or start late', { timeout: 15000 }, async () => {
  const { executeWorkflow } = await import('./executor.mjs');
  const events = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const result = await executeWorkflow({ timeoutMs: 2000, steps: [{ type: 'click', selector: 'button' }] }, {
    workerModule: new URL('./fixtures/hang-worker.mjs', import.meta.url),
    beforeWorkerStart: () => gate, onEvent: event => events.push(event),
  });
  release();
  assert.equal(result.completionCertainty, 'exact');
  assert.equal(result.reason, 'timeout');
  assert.equal(result.completed, 0);
  assert.equal(events.some(event => event.type === 'ownedProcess'), false);
  await assertStopped(events.filter(event => event.pid).map(event => event.pid));
});


test('successful durable admission precedes owned worker effects', { timeout: 20000 }, async () => {
  const { executeWorkflow } = await import('./executor.mjs');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'executor-admission-'));
  const observed = [];
  let admitted = false;
  let effectBeforeAdmission = false;
  try {
    const result = await executeWorkflow({ timeoutMs: 10000, steps: [{ type: 'click', selector: 'button' }] }, {
      artifactsDir: directory, workerModule: new URL('./fixtures/cleanup-success-worker.mjs', import.meta.url),
      beforeWorkerStart: async ({ pid }) => {
        assert.equal(await alive(pid), true);
        await new Promise(resolve => setTimeout(resolve, 40));
        admitted = true;
      },
      onEvent: event => {
        if (event.pid) observed.push(event.pid);
        if (event.type === 'ownedProcess' && !admitted) effectBeforeAdmission = true;
      },
    });
    assert.equal(admitted, true);
    assert.equal(effectBeforeAdmission, false);
    assert.equal(result.ok, true);
    assert.equal(result.completed, 1);
    await assertStopped(observed);
  } finally { await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});
