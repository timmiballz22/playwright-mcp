import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { captureWorkflow } from './workflow-snapshot.mjs';
import { JobJournal, supportsJournal } from './journal.mjs';
import { ownedDescendants } from '../fixtures/process-audit.mjs';

if (supportsJournal) {
  for (const mode of ['success', 'cancel', 'disconnect', 'crash', 'mismatch', 'admissionFailure', 'preDisconnected']) {
    test(`durable guardian ${mode}: cleanup and canonical journal outcome`, { timeout: 20000 }, async context => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'durable-guardian-'));
      let journal;
      let child;
      let exited;
      const owned = [];
      try {
        const config = { directory: path.join(root, 'journal'), projectId: 'b'.repeat(64), ownerId: 'fixture-owner' };
        journal = await JobJournal.open(config);
        const id = randomUUID(); const nonce = randomUUID();
        const workflow = { timeoutMs: 10000, steps: [{ type: 'click', selector: 'fake-private-workflow-canary' }] };
        await journal.call('create', { id, requestKey: randomUUID(), workflowDigest: captureWorkflow(workflow).digest, total: 1, deadlineAt: Date.now() + 12000 });
        assert.equal((await journal.call('reserve', { id, nonce })).acquired, true);
        child = fork(fileURLToPath(new URL(mode === 'preDisconnected' ? './fixtures/pre-disconnected-guardian.mjs' : './guardian.mjs', import.meta.url)), [], {
          stdio: ['ignore', 'ignore', 'ignore', 'ipc'], detached: true, execArgv: [], windowsHide: true,
        });
        exited = once(child, 'exit');
        context.signal.addEventListener('abort', () => child?.kill('SIGKILL'), { once: true });
        let acted = false;
        child.on('message', event => {
          if (event.pid) owned.push(event.pid);
          if (event.type !== 'ownedProcess' || acted) return;
          acted = true;
          if (mode === 'disconnect') child.disconnect();
          if (mode === 'crash') child.kill('SIGKILL');
          if (mode === 'cancel') void journal.call('cancel', { id });
        });
        child.send({ type: 'start', id, nonce, journal: { ...config, instanceId: journal.instanceId, ...(mode === 'admissionFailure' ? { workerModule: new URL('./fixtures/resource-fault.mjs', import.meta.url).href } : {}) },
          workflow: mode === 'mismatch' ? { ...workflow, steps: [{ type: 'click', selector: 'different' }] } : workflow,
          execution: { artifactsDir: path.join(root, 'artifacts'),
            workerModule: new URL(mode === 'success' ? '../fixtures/cleanup-success-worker.mjs' : '../fixtures/hang-worker.mjs', import.meta.url).href },
        });
        const [code] = await exited;
        if (mode === 'preDisconnected') {
          assert.equal(code, 0);
          assert.equal(acted, false);
          const stopped = await journal.call('read', { id });
          assert.equal(stopped.state, 'CANCELLED');
          assert.equal(stopped.completed, 0);
          assert.equal(stopped.completionCertainty, 'exact');
          assert.deepEqual(await ownedDescendants([child.pid, ...owned]), []);
          return;
        }
        if (mode === 'admissionFailure') {
          assert.equal(code, 1);
          assert.equal(acted, false, 'Resource persistence failed after worker effects started');
          await journal.call('recover');
          const failed = await journal.call('read', { id });
          assert.equal(failed.state, 'CRASHED');
          assert.equal(failed.completed, 0);
          assert.equal(failed.operatorAttentionRequired, true);
          assert.deepEqual(await ownedDescendants([child.pid, ...owned]), []);
          return;
        }
        if (mode === 'mismatch') {
          assert.equal(code, 1);
          assert.equal(acted, false);
          assert.equal((await journal.call('read', { id })).state, 'QUEUED');
          const failed = await journal.call('finish', { id, nonce, state: 'FAILED', completed: 0, cleanupOk: true, reason: 'validation_failed' });
          assert.equal(failed.completionCertainty, 'exact');
          assert.deepEqual(await ownedDescendants([child.pid, ...owned]), []);
          return;
        }
        assert.equal(code, mode === 'crash' ? null : 0);
        assert.equal(acted, true);
        if (mode === 'crash') await journal.call('recover');
        const row = await journal.call('read', { id });
        assert.equal(row.state, mode === 'success' ? 'SUCCEEDED' : mode === 'crash' ? 'CRASHED' : 'CANCELLED');
        assert.equal(row.operatorAttentionRequired, mode === 'crash');
        if (mode === 'crash') {
          await assert.rejects(journal.call('result', { id }), { code: 'result_expired' });
          for (let attempt = 0; attempt < 60; attempt++) {
            if (!(await ownedDescendants([child.pid, ...owned])).length) break;
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          assert.deepEqual(await ownedDescendants([child.pid, ...owned]), []);
          const next = await journal.call('create', { id: randomUUID(), requestKey: randomUUID(), workflowDigest: 'd'.repeat(64), total: 1, deadlineAt: Date.now() + 30000 });
          assert.deepEqual(await journal.call('reserve', { id: next.jobId, nonce: randomUUID() }), { acquired: false, reason: 'cleanup_blocked' });
          return;
        }
        const result = await journal.call('result', { id });
        assert.equal(result.ok, mode === 'success');
        assert.equal(result.reportPath, undefined);
        assert.equal(JSON.stringify(result).includes('fake-private-workflow-canary'), false);
        assert.deepEqual(await ownedDescendants([child.pid, ...owned]), []);
        for (const name of await readdir(config.directory)) {
          assert.equal((await readFile(path.join(config.directory, name))).includes(Buffer.from('fake-private-workflow-canary')), false);
        }
        assert.deepEqual(await journal.call('integrity'), { ok: true });
      } finally {
        if (child && child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL'); if (exited) await exited;
        }
        await journal?.close();
        await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    });
  }
}
