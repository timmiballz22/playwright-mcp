import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { JobJournal, supportsJournal } from './journal.mjs';

if (!supportsJournal) {
  test('commit initialization recovery stays unsupported before Node22.13', async () => {
    await assert.rejects(JobJournal.open(), { code: 'unsupported_runtime' });
  });
} else {
  let activeHandles;
  const abort = JobJournal.prototype.abort;
  JobJournal.prototype.abort = function(...args) {
    if (activeHandles && !activeHandles.has(this.child)) {
      const record = { child: this.child, closed: false, exited: false };
      record.completion = new Promise(resolve => this.child.once('close', () => { record.closed = true; resolve(); }));
      record.exitedCompletion = new Promise(resolve => this.child.once('exit', () => { record.exited = true; resolve(); }));
      activeHandles.set(this.child, record);
    }
    return Reflect.apply(abort, this, args);
  };
  const nativeKill = ChildProcess.prototype.kill;
  async function fixture(phase, callback) {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'journal-commit-retry-'));
    const clients = [], handles = new Map(); activeHandles = handles;
    const previous = process.env.PLAYWRIGHT_TEST_COMMIT_TIMEOUT_PHASE;
    process.env.PLAYWRIGHT_TEST_COMMIT_TIMEOUT_PHASE = phase;
    const config = { directory, projectId: '7'.repeat(64), ownerId: 'owned-commit-retry' };
    const open = async (extra = {}) => { const j = await JobJournal.open({ ...config, workerModule: new URL('./fixtures/commit-timeout-once.mjs', import.meta.url), ...extra }); clients.push(j); return j; };
    const attempts = async () => (await readFile(path.join(directory, 'commit-attempts.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    let primary, verified = false, removalAttempted = false;
    const failures = [];
    try { await callback({ directory, config, open, attempts, handles, clients }); verified = true; }
    catch (error) { primary = error; }
    finally {
      if (previous === undefined) delete process.env.PLAYWRIGHT_TEST_COMMIT_TIMEOUT_PHASE;
      else process.env.PLAYWRIGHT_TEST_COMMIT_TIMEOUT_PHASE = previous;
      const closed = await Promise.allSettled(clients.map(client => client.close()));
      failures.push(...closed.filter(x => x.status === 'rejected').map(x => x.reason));
      for (const record of handles.values()) {
        let timer;
        try {
          if (!record.exited) { record.child.ref(); Reflect.apply(nativeKill, record.child, ['SIGKILL']); } // Captured owned handle only.
          // The deliberately disconnected channel may never emit close. Require
          // the real kernel-backed process exit for this test-owned cleanup;
          // production retry authority still requires waitForExit's close event.
          await Promise.race([record.exitedCompletion, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Owned calibration worker exit unconfirmed')), 2000); })]);
          if (!record.closed) console.log(JSON.stringify({ fixture: 'journal_commit_retry_late_exit', processExitObserved: record.exited, wireCloseObserved: record.closed, signalCode: record.child.signalCode }));
        } catch (error) { failures.push(error); }
        finally { clearTimeout(timer); }
      }
      activeHandles = undefined;
      if (verified && !primary && !failures.length) {
        removalAttempted = true;
        try { await rm(directory, { recursive: true, force: true }); }
        catch (error) { failures.push(error); }
      }
      if (!verified || primary || failures.length) console.error(JSON.stringify({ fixture: 'journal_commit_retry_workspace_unconfirmed', workspace: path.basename(directory), removalAttempted,
        primaryFailed: Boolean(primary), cleanupFailures: failures.length,
        workers: [...handles.values()].map(record => ({ closed: record.closed, exited: record.exited, exitCode: record.child.exitCode, signalCode: record.child.signalCode, killed: record.child.killed, connected: record.child.connected })) }));
    }
    if (failures.length) throw new AggregateError(primary ? [primary, ...failures] : failures, 'Commit retry calibration or cleanup failed', { cause: primary ?? failures[0] });
    if (primary) throw primary;
  }
  test('confirmed worker exit after pre-COMMIT timeout permits bounded fresh initialization', { timeout: 15000 }, async () => {
    await fixture('before', async ({ open, attempts, handles }) => {
      const journal = await open(); assert.deepEqual(await journal.call('integrity'), { ok: true });
      assert.deepEqual(await journal.call('list'), []);
      const rows = await attempts(); assert.ok(rows.length >= 2 && rows.length <= 3);
      assert.equal(rows[0].pause, true); assert.ok(rows.slice(1).every(row => !row.pause));
      assert.ok([...handles.values()].every(record => record.closed));
    });
  });
  test('lost init acknowledgement after real COMMIT preserves existing jobs and key', { timeout: 15000 }, async () => {
    await fixture('after', async ({ directory, config, open, attempts, clients }) => {
      const seed = await JobJournal.open(config); clients.push(seed);
      const id = randomUUID(); await seed.call('create', { id, requestKey: 'existing', workflowDigest: 'a'.repeat(64), total: 1, deadlineAt: Date.now() + 60000 });
      const prior = await seed.call('list'); const key = await readFile(path.join(directory, 'journal.key')); await seed.close();
      const journal = await open(); assert.deepEqual(await journal.call('list'), prior);
      assert.equal((await readFile(path.join(directory, 'journal.key'))).equals(key), true);
      assert.deepEqual(await journal.call('integrity'), { ok: true });
      const rows = await attempts(); assert.ok(rows.length >= 2 && rows.length <= 3); assert.equal(rows[0].pause, true);
    });
  });
  test('persistent real COMMIT pause exhausts the unchanged three-attempt initialization cap', { timeout: 15000 }, async () => {
    await fixture('persistent', async ({ open, attempts, handles }) => {
      await assert.rejects(open(), error => {
        assert.equal(error.code, 'journal_unavailable'); assert.equal(error.journalFailure, 'rpc_timeout');
        assert.equal(error.journalFailureCommand, 'init'); assert.equal(error.journalInitStage, 'schema_commit');
        assert.equal(error.journalExitConfirmed, true); return true;
      });
      assert.equal((await attempts()).length, 3); assert.equal(handles.size, 3);
      assert.ok([...handles.values()].every(record => record.closed));
    });
  });
  test('store version changed between confirmed exit and retry is refused without repair', { timeout: 15000 }, async () => {
    await fixture('before', async ({ directory, open, handles }) => {
      const { DatabaseSync } = await import('node:sqlite'); const wait = JobJournal.prototype.waitForExit;
      let changed = false;
      JobJournal.prototype.waitForExit = async function(...args) {
        const closed = await Reflect.apply(wait, this, args);
        if (closed && !changed) { const db = new DatabaseSync(path.join(directory, 'jobs.sqlite')); try { db.exec('PRAGMA user_version=2'); changed = true; } finally { db.close(); } }
        return closed;
      };
      try { await assert.rejects(open(), { code: 'unsupported_schema', journalExitConfirmed: true }); }
      finally { JobJournal.prototype.waitForExit = wait; }
      assert.equal(changed, true); assert.equal(handles.size, 2);
      const db = new DatabaseSync(path.join(directory, 'jobs.sqlite')); try { assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2); } finally { db.close(); }
    });
  });
  test('actual unconfirmed worker exit never authorizes an initialization retry', { timeout: 15000 }, async () => {
    await fixture('before', async ({ open, attempts, handles }) => {
      const recordedAbort = JobJournal.prototype.abort;
      JobJournal.prototype.abort = function(...args) {
        // Deliberately withhold the signal; the real child remains alive during waitForExit.
        this.child.kill = () => false;
        return Reflect.apply(recordedAbort, this, args);
      };
      try { await assert.rejects(open(), { code: 'journal_unavailable', journalExitConfirmed: false }); }
      finally { JobJournal.prototype.abort = recordedAbort; }
      assert.equal((await attempts()).length, 1); assert.equal(handles.size, 1);
      assert.ok([...handles.values()].every(record => !record.closed && !record.exited));
      // fixture() then kills and observes this same captured handle before deletion.
    });
  });
  test('non-COMMIT initialization timeout keeps one attempt and its original phase', { timeout: 15000 }, async () => {
    await fixture('before', async ({ open, handles }) => {
      const previous = process.env.PLAYWRIGHT_TEST_JOURNAL_INIT_PAUSE;
      process.env.PLAYWRIGHT_TEST_JOURNAL_INIT_PAUSE = 'schema_verify';
      try {
        await assert.rejects(open({ workerModule: new URL('./fixtures/transaction-fault.mjs', import.meta.url) }), { code: 'journal_unavailable', journalFailure: 'rpc_timeout', journalInitStage: 'schema_verify', journalExitConfirmed: true });
      } finally {
        if (previous === undefined) delete process.env.PLAYWRIGHT_TEST_JOURNAL_INIT_PAUSE;
        else process.env.PLAYWRIGHT_TEST_JOURNAL_INIT_PAUSE = previous;
      }
      assert.equal(handles.size, 1);
    });
  });
}
