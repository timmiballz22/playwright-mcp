import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { executeWorkflow } from '../executor.mjs';
import { ownedScopeDescendants } from '../fixtures/process-audit.mjs';
import { JobController } from './controller.mjs';
import { supportsJournal } from './journal.mjs';
const workerModule = new URL('./fixtures/unreported-owner-worker.mjs', import.meta.url).href;
const workflow = { timeoutMs: 15000, steps: [{ type: 'waitFor', selector: 'body' }] };
async function waitPid(file) {
  const end = performance.now() + 5000;
  do {
    try { const pid = Number(await readFile(file, 'utf8')); if (Number.isSafeInteger(pid) && pid > 1) return pid; } catch {}
    await new Promise(resolve => setTimeout(resolve, 20));
  } while (performance.now() < end);
  assert.fail('Private fixture startup receipt missing');
}
async function controlled(body) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'unreported-launch-')));
  const control = path.join(root, 'control'); await mkdir(control, { mode: 0o700 });
  const previous = process.env.PLAYWRIGHT_TEST_UNREPORTED_CONTROL;
  process.env.PLAYWRIGHT_TEST_UNREPORTED_CONTROL = control;
  const scope = { roots: new Set(), identities: new Map() }; let close; let operation; let verified = false; let accepted = false;
  const onEvent = event => { if (event.pid) scope.roots.add(event.pid); };
  try {
    await body({ root, control, scope, onEvent,
      register: (pending, cleanup) => { operation = pending; close = cleanup; },
      crash: async () => {
        await waitPid(path.join(control, 'worker-ready'));
        const childPid = await waitPid(path.join(control, 'child-ready'));
        assert.ok((await ownedScopeDescendants([scope], { rememberLiveRoots: true })).includes(childPid), 'Unreported child must first be observed under an owned live worker');
        await writeFile(path.join(control, 'crash-worker'), '', { flag: 'wx', mode: 0o600 });
        return childPid;
      },
    });
    accepted = true;
  } finally {
    try {
      await writeFile(path.join(control, 'stop-child'), '', { mode: 0o600 });
      if (close) await close();
      if (operation) await Promise.allSettled([operation]);
      const end = performance.now() + 8000;
      do {
        if (!(await ownedScopeDescendants([scope])).length) { verified = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      } while (performance.now() < end);
      assert.equal(verified, true, 'Private controlled child did not acknowledge self-exit');
    } finally {
      if (previous === undefined) delete process.env.PLAYWRIGHT_TEST_UNREPORTED_CONTROL;
      else process.env.PLAYWRIGHT_TEST_UNREPORTED_CONTROL = previous;
      if (verified && accepted) await rm(root, { recursive: true, force: true });
      else console.error('Unreported launch fixture preserved: ' + root);
    }
  }
}
test('unexpected exit cannot certify an unreported live browser model as cleaned', { timeout: 30000 }, async () => controlled(async ({ root, scope, onEvent, register, crash }) => {
  const pending = executeWorkflow(workflow, { artifactsDir: path.join(root, 'artifacts'), workerModule, onEvent }); register(pending);
  const childPid = await crash(); const result = await pending;
  assert.ok((await ownedScopeDescendants([scope])).includes(childPid), 'Fault must preserve the unreported live-child witness');
  assert.equal(result.execution.cleanup, 'failed'); assert.equal(result.reason, 'cleanup_failed');
  assert.ok(result.execution.terminationFailures.includes('browser_ownership_unconfirmed'));
  assert.equal(result.completed, 0); assert.equal(result.retrySafe, false);
}));
if (supportsJournal) test('unreported browser uncertainty retains durable admission fence after child self-exit', { timeout: 30000 }, async () => controlled(async ({ root, scope, onEvent, register, crash, control }) => {
  const config = { journal: { directory: path.join(root, 'journal'), projectId: 'f'.repeat(64), ownerId: randomUUID() }, execution: { artifactsDir: path.join(root, 'artifacts'), workerModule }, onEvent };
  let controller = await JobController.open(config);
  register(undefined, async () => { if (controller) await controller.close(); });
  const key = randomUUID(); const job = await controller.start(workflow, key); const childPid = await crash();
  let row; const end = performance.now() + 10000;
  do { row = await controller.status(job.jobId); if (row.state === 'FAILED' || row.state === 'CRASHED') break; await new Promise(resolve => setTimeout(resolve, 25)); } while (performance.now() < end);
  assert.ok((await ownedScopeDescendants([scope])).includes(childPid));
  assert.equal(row.operatorAttentionRequired, true); assert.equal(row.completed, 0);
  assert.equal((await controller.start(workflow, key)).jobId, job.jobId);
  await assert.rejects(controller.start(workflow, randomUUID()), { code: 'cleanup_blocked' });
  await writeFile(path.join(control, 'stop-child'), '', { mode: 0o600 });
  await controller.close(); controller = await JobController.open(config);
  await assert.rejects(controller.start(workflow, randomUUID()), { code: 'cleanup_blocked' });
}));
