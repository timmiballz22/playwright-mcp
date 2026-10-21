// Source/installed-package real browser verification; no model turns.
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
const target = process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url));
const { JobJournal, supportsJournal } = await import(pathToFileURL(path.join(target, 'local-batch/jobs/journal.mjs')).href);
const { ownedDescendants } = await import(pathToFileURL(path.join(target, 'local-batch/fixtures/process-audit.mjs')).href);
if (!supportsJournal) {
  process.stdout.write(JSON.stringify({ component: 'durable_guardian_parent_death', supported: false, requiredNode: '22.13+' }) + '\n');
} else {
const root = await mkdtemp(path.join(os.tmpdir(), 'guardian-real-parent-death-'));
const owner = fork(path.join(target, 'local-batch/fixtures/guardian-real-owner.mjs'), [root], { stdio: ['ignore', 'pipe', 'ignore', 'ipc'], execArgv: [] });
const ownerExit = once(owner, 'exit');
const lines = createInterface({ input: owner.stdout });
let journal; let timer; let observed = []; let safeToRemove = false;
try {
  const ready = await Promise.race([new Promise((resolve, reject) => lines.once('line', line => { try { resolve(JSON.parse(line)); } catch { reject(new Error('invalid_fixture_ready')); } })), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('fixture_ready_timeout')), 15000); }), ownerExit.then(() => { throw new Error('fixture_exited_before_ready'); })]);
  clearTimeout(timer);
  observed = await ownedDescendants(ready.roots);
  assert.ok(observed.length >= 5, 'Real execution ownership was not observed');
  owner.kill('SIGKILL'); await ownerExit;
  journal = await JobJournal.open({ directory: path.join(root, 'journal'), projectId: 'e'.repeat(64), ownerId: 'parent-death-fixture' });
  let row;
  const end = performance.now() + 10000;
  do { row = await journal.call('read', { id: ready.jobId }); if (row.state === 'CANCELLED') break; await new Promise(resolve => setTimeout(resolve, 50)); } while (performance.now() < end);
  assert.equal(row.state, 'CANCELLED'); assert.equal(row.operatorAttentionRequired, false);
  assert.equal(row.total, 2); assert.ok(row.completed >= 0 && row.completed <= 1);
  assert.deepEqual(await ownedDescendants(observed), []); safeToRemove = true;
  const next = await journal.call('create', { id: randomUUID(), requestKey: 'after-cleanup', workflowDigest: 'f'.repeat(64), total: 1, deadlineAt: Date.now() + 10000 });
  const nonce = randomUUID(); assert.equal((await journal.call('reserve', { id: next.jobId, nonce })).acquired, true);
  await journal.call('cancel', { id: next.jobId }); await journal.call('activate', { id: next.jobId, nonce });
  assert.deepEqual(await journal.call('integrity'), { ok: true });
  console.log(JSON.stringify({ component: 'durable_guardian', controller: 'internal_job_controller', os: process.platform, realBrowser: 'chromium', controllerSignal: 'SIGKILL', observedOwnedProcesses: observed.length, terminalState: row.state, completed: row.completed, total: row.total, activeOwnedProcesses: 0, projectLeaseReleased: true, integrity: true, modelTurns: 0 }));
} finally {
  clearTimeout(timer); lines.close(); owner.stdout.destroy();
  if (owner.exitCode === null && owner.signalCode === null) { owner.kill('SIGKILL'); await ownerExit; }
  await journal?.close();
  if (!safeToRemove && observed.length) {
    const cleanupEnd = performance.now() + 40000;
    while (performance.now() < cleanupEnd) {
      if (!(await ownedDescendants(observed)).length) { safeToRemove = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  // Keep the private diagnostic workspace if live ownership cannot be disproved.
  if (safeToRemove) await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

}
