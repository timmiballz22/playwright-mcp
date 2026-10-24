import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { captureWorkflow } from './workflow-snapshot.mjs';
import { JobJournal, supportsJournal } from './journal.mjs';
import { ownedDescendants, ownedScopeDescendants } from '../fixtures/process-audit.mjs';

if (supportsJournal) {
  for (const mode of ['success', 'cancel', 'disconnect', 'crash', 'mismatch', 'admissionFailure', 'admissionTimeout', 'preDisconnected']) {
    test(`durable guardian ${mode}: cleanup and canonical journal outcome`, { timeout: 20000 }, async context => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'durable-guardian-'));
      let journal;
      let child;
      let exited;
      const owned = [];
      let scope; let observation; let verified = false;
      async function auditOwned(phase, rememberLiveRoots = false) {
        if (!scope) return ownedDescendants([child.pid, ...owned]);
        let legacy;
        const observed = await ownedScopeDescendants([scope], {
          rememberLiveRoots,
          compareLegacyRoots: [child.pid, ...owned], onLegacyObservation: value => { legacy = value; },
        });
        if (process.platform === 'win32') {
          assert.ok(legacy, 'Same-snapshot guardian legacy comparison missing');
          for (const pid of owned) assert.ok(scope.identities.has(pid), 'Reported owned child lacks a live birth record');
        }
        const receipt = JSON.stringify({ fixture: 'guardian_live_scope', mode, phase, observed,
          legacy, roots: [...scope.roots], identities: [...scope.identities] });
        assert.ok(Buffer.byteLength(receipt) <= 65536, 'Guardian comparison receipt byte bound exceeded');
        await writeFile(path.join(root, phase + '.json'), receipt, { flag: 'wx', mode: 0o600 });
        if (legacy?.legacyOnly.length) console.log(receipt);
        return observed;
      }
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
        if (mode === 'disconnect') {
          scope = { roots: new Set([child.pid]), identities: new Map() };
          assert.equal(child.exitCode, null); assert.equal(child.signalCode, null);
          await auditOwned('before_start', true);
          assert.equal(child.exitCode, null); assert.equal(child.signalCode, null);
          scope.liveRoots = new Set([child.pid]);
        }
        let acted = false;
        let diagnostic;
        child.on('message', event => {
          if (event.type === 'failed') diagnostic = event.diagnostic;
          if (event.pid) owned.push(event.pid);
          if (event.type !== 'ownedProcess' || acted) return;
          acted = true;
          if (mode === 'disconnect') {
            observation = (async () => {
              try {
                assert.equal(child.exitCode, null); assert.equal(child.signalCode, null);
                const live = await auditOwned('before_disconnect', true);
                assert.equal(child.exitCode, null); assert.equal(child.signalCode, null);
                assert.ok(live.includes(event.pid), 'Owned model child must be observed before disconnect');
              } finally { if (child.connected) child.disconnect(); }
            })();
            void observation.catch(() => {});
          }
          if (mode === 'crash') child.kill('SIGKILL');
          if (mode === 'cancel') void journal.call('cancel', { id });
        });
        child.send({ type: 'start', id, nonce, journal: { ...config, instanceId: journal.instanceId, ...(['admissionFailure', 'admissionTimeout'].includes(mode) ? { workerModule: new URL(mode === 'admissionFailure' ? './fixtures/resource-fault.mjs' : './fixtures/resource-timeout.mjs', import.meta.url).href } : {}) },
          workflow: mode === 'mismatch' ? { ...workflow, steps: [{ type: 'click', selector: 'different' }] } : workflow,
          execution: { artifactsDir: path.join(root, 'artifacts'),
            workerModule: new URL(mode === 'success' ? '../fixtures/cleanup-success-worker.mjs' : '../fixtures/hang-worker.mjs', import.meta.url).href },
        });
        const [code] = await exited;
        await observation;
        if (mode === 'preDisconnected') {
          assert.equal(code, 0);
          assert.equal(acted, false);
          const stopped = await journal.call('read', { id });
          assert.equal(stopped.state, 'CANCELLED');
          assert.equal(stopped.completed, 0);
          assert.equal(stopped.completionCertainty, 'exact');
          assert.deepEqual(await ownedDescendants([child.pid, ...owned]), []);
          verified = true;
          return;
        }
        if (['admissionFailure', 'admissionTimeout'].includes(mode)) {
          if (mode === 'admissionTimeout') {
            const { stage, command, ...cause } = diagnostic;
            assert.deepEqual(cause, { code: 'journal_unavailable', journalFailure: 'rpc_timeout', journalFailureCommand: 'resources' });
            assert.ok(stage === 'poll' && command === 'read' || stage === 'write' && command === 'resources', 'Only a pending poll or resource write may first observe this loss');
          } else assert.deepEqual(diagnostic, { stage: 'write', code: 'storage_full', command: 'resources' });
          assert.equal(code, 1);
          assert.equal(acted, false, 'Resource persistence failed after worker effects started');
          await journal.call('recover');
          const failed = await journal.call('read', { id });
          assert.equal(failed.state, 'CRASHED');
          assert.equal(failed.completed, 0);
          assert.equal(failed.operatorAttentionRequired, true);
          assert.deepEqual(await ownedDescendants([child.pid, ...owned]), []);
          verified = true;
          return;
        }
        if (mode === 'mismatch') {
          assert.equal(code, 1);
          assert.equal(acted, false);
          assert.equal((await journal.call('read', { id })).state, 'QUEUED');
          const failed = await journal.call('finish', { id, nonce, state: 'FAILED', completed: 0, cleanupOk: true, reason: 'validation_failed' });
          assert.equal(failed.completionCertainty, 'exact');
          assert.deepEqual(await ownedDescendants([child.pid, ...owned]), []);
          verified = true;
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
          verified = true;
          return;
        }
        const result = await journal.call('result', { id });
        assert.equal(result.ok, mode === 'success');
        assert.equal(result.reportPath, undefined);
        assert.equal(JSON.stringify(result).includes('fake-private-workflow-canary'), false);
        assert.deepEqual(await auditOwned('after_exit'), []);
        for (const name of await readdir(config.directory)) {
          assert.equal((await readFile(path.join(config.directory, name))).includes(Buffer.from('fake-private-workflow-canary')), false);
        }
        assert.deepEqual(await journal.call('integrity'), { ok: true });
        verified = true;
      } finally {
        if (child && child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL'); if (exited) await exited;
        }
        await journal?.close();
        if (verified) await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        else console.error('Guardian fixture preserved: acceptance not confirmed');
      }
    });
  }
}
