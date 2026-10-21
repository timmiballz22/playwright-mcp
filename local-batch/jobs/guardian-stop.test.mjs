import { test } from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { JobController } from './controller.mjs';
import { resolveJobConfig } from './config.mjs';
import { supportsJournal } from './journal.mjs';

if (supportsJournal) test('unconfirmed guardian journal exit stops the next queued job even after terminal metadata', { timeout: 30000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guardian-journal-stop-'));
  const originalFork = childProcess.fork; let controller; let verified = false; let fixtureFailure;
  let release; const gate = new Promise(resolve => { release = resolve; });
  let spawned = 0; const diagnostics = [];
  try {
    const config = await resolveJobConfig({ env: { PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(),
      PLAYWRIGHT_JOBS_PROJECT_DIR: root, PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'state') } });
    controller = await JobController.open({ ...config, onEvent: event => {
      if (event.type === 'guardianSpawned') spawned++;
      if (event.type === 'guardianFailed') diagnostics.push(event.diagnostic);
    } });
    // Synthetic guardian metadata only; real journal transactions still run.
    // No browser or OS PID is signalled by this private process-handle fixture.
    childProcess.fork = (module, ...args) => {
      if (!String(module).endsWith('guardian.mjs')) return originalFork(module, ...args);
      const child = new EventEmitter(); child.connected = true; child.pid = 2147483647;
      child.unref = () => {}; child.kill = () => { queueMicrotask(() => child.emit('close', 1, 'SIGKILL')); return true; };
      child.disconnect = () => { child.connected = false; queueMicrotask(() => { child.emit('disconnect'); child.emit('exit', 1, 'SIGTERM'); child.emit('close', 1, 'SIGTERM'); }); };
      child.send = (packet, callback) => { callback?.(null); void (async () => {
        await gate;
        await controller.journal.call('activate', { id: packet.id, nonce: packet.nonce });
        await controller.journal.call('finish', { id: packet.id, nonce: packet.nonce, state: 'SUCCEEDED', completed: 1, cleanupOk: true,
          summary: { ok: true, completed: 1, total: 1, runId: randomUUID() } });
        child.emit('exit', 1, null);
        // Model exit-before-stdio-close ordering, retaining final failure IPC.
        setTimeout(() => {
          child.emit('message', { type: 'failed', diagnostic: { stage: 'journal_close', code: 'journal_unavailable', command: 'close',
            journalFailure: 'closed', journalFailureCommand: 'close', journalExitConfirmed: false, message: 'fake-private-stop-canary' } });
          child.connected = false; child.emit('disconnect');
          child.emit('close', 1, null);
        }, 20);
      })().catch(error => { fixtureFailure = error; child.emit('error', error); }); };
      return child;
    };
    syncBuiltinESMExports();
    const workflow = { timeoutMs: 10000, steps: [{ type: 'waitFor', selector: '#unused' }] };
    const first = await controller.start(workflow, 'first'); const second = await controller.start(workflow, 'second');
    release();
    const end = performance.now() + 5000;
    while ((!spawned || controller.active) && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 10));
    if (fixtureFailure) throw fixtureFailure;
    assert.equal((await controller.status(first.jobId)).state, 'SUCCEEDED', 'Prior terminal metadata stays intact');
    assert.equal(controller.blocked, true); assert.equal(spawned, 1);
    assert.equal((await controller.status(second.jobId)).state, 'QUEUED');
    await assert.rejects(controller.start(workflow, 'third'), { code: 'cleanup_blocked' });
    assert.equal(diagnostics[0].journalExitConfirmed, false);
    assert.equal(JSON.stringify(diagnostics).includes('fake-private-stop-canary'), false);
    verified = true;
  } finally {
    release?.(); childProcess.fork = originalFork; syncBuiltinESMExports();
    if (controller) { const closed = await controller.close(); if (verified) assert.equal(closed.cleanupConfirmed, false); }
    if (verified) await rm(root, { recursive: true, force: true });
    else console.error('Guardian journal-stop fixture preserved: queue fence not confirmed');
  }
});
