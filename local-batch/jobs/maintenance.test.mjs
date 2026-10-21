import { test } from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { JobController } from './controller.mjs';
import { resolveJobConfig } from './config.mjs';
import { mkdtemp, realpath, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { JobJournal, JournalError, supportsJournal } from './journal.mjs';

async function completed(journal) {
  const id = randomUUID(); const nonce = randomUUID(); const key = randomUUID();
  const input = { id, requestKey: key, workflowDigest: 'a'.repeat(64), total: 1, deadlineAt: Date.now() + 60000 };
  await journal.call('create', input); await journal.call('reserve', { id, nonce }); await journal.call('activate', { id, nonce });
  await journal.call('finish', { id, nonce, state: 'SUCCEEDED', completed: 1, cleanupOk: true,
    summary: { ok: true, completed: 1, total: 1, runId: randomUUID() } });
  return { id, input };
}

if (supportsJournal) test('terminal cleanup reservation fences new admissions and other actors without changing history', async () => {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'maintenance-lease-')));
  let first; let second; let foreign;
  try {
    const config = { directory, projectId: 'f'.repeat(64), ownerId: randomUUID() };
    first = await JobJournal.open({ ...config, instanceId: randomUUID() }); second = await JobJournal.open({ ...config, instanceId: randomUUID() });
    foreign = await JobJournal.open({ ...config, ownerId: randomUUID(), instanceId: randomUUID() });
    const record = await completed(first); const nonce = randomUUID();
    const before = await first.call('read', { id: record.id }); const events = await first.call('events', { id: record.id });
    assert.equal((await first.call('cleanup_reserve', { id: record.id, nonce })).acquired, true);
    await assert.rejects(foreign.call('cleanup_reserve', { id: record.id, nonce: randomUUID() }), { code: 'not_found' });
    await assert.rejects(first.call('cleanup_reserve', { id: record.id, nonce }), { code: 'controller_busy' });
    await assert.rejects(second.call('create', { ...record.input, id: randomUUID(), requestKey: 'new' }), { code: 'controller_busy' });
    assert.equal((await second.call('create', record.input)).jobId, record.id, 'Existing keys stay deduplicated without replay');
    await assert.rejects(first.call('cleanup_release', { id: record.id, nonce: 'fake-invalid-nonce' }), { code: 'invalid_metadata' });
    await assert.rejects(first.call('cleanup_release', { id: record.id, nonce: randomUUID() }), { code: 'invalid_lease' });
    await assert.rejects(second.call('cleanup_release', { id: record.id, nonce }), { code: 'invalid_lease' });
    assert.equal((await first.call('cleanup_release', { id: record.id, nonce })).released, true);
    assert.deepEqual(await first.call('read', { id: record.id }), before);
    assert.deepEqual(await first.call('events', { id: record.id }), events);
    const queued = await second.call('create', { ...record.input, id: randomUUID(), requestKey: 'after' });
    assert.equal(queued.state, 'QUEUED');
    await assert.rejects(second.call('cleanup_reserve', { id: queued.jobId, nonce: randomUUID() }), { code: 'not_terminal' });
  } finally { await foreign?.close(); await second?.close(); await first?.close(); await rm(directory, { recursive: true, force: true }); }
});

if (supportsJournal) test('unconfirmed cleanup stays blocked across reopen and cannot be cleared by ordinary release', async () => {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'maintenance-uncertain-')));
  let journal;
  try {
    const config = { directory, projectId: 'f'.repeat(64), ownerId: randomUUID() };
    journal = await JobJournal.open(config); const record = await completed(journal); const nonce = randomUUID();
    await journal.call('cleanup_reserve', { id: record.id, nonce });
    await journal.call('cleanup_uncertain', { id: record.id, nonce });
    await assert.rejects(journal.call('cleanup_release', { id: record.id, nonce }), { code: 'cleanup_blocked' });
    await journal.close(); journal = await JobJournal.open(config);
    assert.equal((await journal.call('recover')).cleanupBlocked, true);
    assert.equal((await journal.call('read', { id: record.id })).operatorAttentionRequired, true);
    assert.equal((await journal.call('result', { id: record.id })).ok, true, 'Prior job results are retained');
    assert.equal((await journal.call('create', record.input)).jobId, record.id);
    await assert.rejects(journal.call('create', { ...record.input, id: randomUUID(), requestKey: 'blocked' }), { code: 'cleanup_blocked' });
    assert.deepEqual(await journal.call('integrity'), { ok: true });
  } finally { await journal?.close(); await rm(directory, { recursive: true, force: true }); }
});


if (supportsJournal) for (const loseFinalization of [false, true]) test(`unconfirmed artifact worker is fenced durably from another controller${loseFinalization ? ' after lost finalization' : ''}`, async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'maintenance-controller-')));
  let journal; let controller; let observer; let verified = false;
  const originalFork = childProcess.fork; const originalTimer = globalThis.setTimeout;
  try {
    const config = await resolveJobConfig({ env: { PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(),
      PLAYWRIGHT_JOBS_PROJECT_DIR: root, PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'state') } });
    journal = await JobJournal.open(config.journal); const record = await completed(journal);
    const result = await journal.call('result', { id: record.id });
    const scope = path.join(config.execution.artifactsDir, 'exec-' + result.runId);
    await mkdir(scope, { mode: 0o700 }); await writeFile(path.join(scope, 'marker'), 'private marker', { mode: 0o600 });
    await journal.close(); journal = undefined;
    controller = await JobController.open(config);
    const originalCall = controller.journal.call.bind(controller.journal); let finalizations = 0;
    controller.journal.call = (command, data) => {
      if (command === 'cleanup_uncertain') {
        finalizations++;
        if (loseFinalization) return Promise.reject(new JournalError('journal_unavailable'));
      }
      return originalCall(command, data);
    };
    // Only this test's artifact child is simulated. No OS process/PID is killed;
    // real journal children still use the original fork. This models a missing
    // termination acknowledgement, not a proven uninterruptible kernel process.
    childProcess.fork = (module, ...args) => {
      if (!String(module).endsWith('artifact-cleanup-worker.mjs')) return originalFork(module, ...args);
      const child = new EventEmitter(); child.pid = 2147483647; child.connected = true;
      child.kill = () => false; child.unref = () => {}; child.disconnect = () => { child.connected = false; };
      child.send = (_message, callback) => { queueMicrotask(() => callback?.(null)); };
      queueMicrotask(() => child.emit('spawn')); return child;
    };
    syncBuiltinESMExports();
    globalThis.setTimeout = (callback, delay, ...args) => originalTimer(callback, [5000, 1000].includes(delay) ? 20 : delay, ...args);
    await assert.rejects(controller.cleanup(record.id, false), error => {
      if (loseFinalization) {
        assert.ok(error instanceof AggregateError); assert.equal(error.code, 'journal_unavailable');
        assert.deepEqual(error.errors.map(item => item.code), ['cleanup_unconfirmed', 'journal_unavailable']);
      } else assert.equal(error.code, 'cleanup_unconfirmed');
      return true;
    });
    assert.equal(finalizations, 1, 'Ambiguous finalization must not replay');
    childProcess.fork = originalFork; syncBuiltinESMExports(); globalThis.setTimeout = originalTimer;
    assert.equal(await readFile(path.join(scope, 'marker'), 'utf8'), 'private marker');
    observer = await JobController.open(config);
    assert.equal(observer.blocked, !loseFinalization, 'Acknowledged uncertainty is visible; a lost mark retains its busy lease');
    assert.equal((await observer.status(record.id)).operatorAttentionRequired, !loseFinalization);
    await assert.rejects(observer.start({ steps: [{ type: 'waitFor', selector: '#unused' }] }, 'must-not-start'), { code: loseFinalization ? 'controller_busy' : 'cleanup_blocked' });
    assert.equal((await observer.result(record.id)).ok, true, 'Original job metadata remains available');
    verified = true;
  } finally {
    childProcess.fork = originalFork; syncBuiltinESMExports(); globalThis.setTimeout = originalTimer;
    await observer?.close(); await controller?.close(); await journal?.close();
    if (verified) await rm(root, { recursive: true, force: true });
    else console.error('Maintenance fixture preserved: durable fence not verified');
  }
});


if (supportsJournal) test('dead maintenance holder becomes uncertain without releasing its reservation or execution history', { timeout: 30000 }, async t => {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'maintenance-owner-death-')));
  let journal; let holder; let verified = false;
  try {
    const config = { directory, projectId: 'f'.repeat(64), ownerId: randomUUID() };
    journal = await JobJournal.open(config); const record = await completed(journal); const nonce = randomUUID();
    const before = await journal.call('read', { id: record.id }); const events = await journal.call('events', { id: record.id });
    await journal.close(); journal = undefined;
    const program = path.join(directory, 'holder.mjs');
    await writeFile(program, `import { JobJournal } from ${JSON.stringify(new URL('./journal.mjs', import.meta.url).href)};
const journal = await JobJournal.open(${JSON.stringify(config)});
await journal.call('cleanup_reserve', ${JSON.stringify({ id: record.id, nonce })});
process.on('message', () => {});
process.send({held:true});`);
    holder = childProcess.fork(program, [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: [], windowsHide: true });
    const ready = await Promise.race([once(holder, 'message', { signal: t.signal }),
      once(holder, 'exit').then(() => { throw new Error('Maintenance holder exited before reservation acknowledgement'); })]);
    assert.equal(ready[0].held, true);
    journal = await JobJournal.open(config);
    assert.equal((await journal.call('recover')).cleanupBlocked, false, 'Live maintenance is busy, not a permanently blocked observer');
    const exited = once(holder, 'exit'); holder.kill('SIGKILL'); await exited;
    assert.equal((await journal.call('recover')).cleanupBlocked, true);
    const after = await journal.call('read', { id: record.id });
    assert.equal(after.operatorAttentionRequired, true); assert.equal(after.state, before.state);
    assert.equal(after.updatedAt, before.updatedAt); assert.equal(after.completed, before.completed);
    assert.deepEqual(await journal.call('events', { id: record.id }), events);
    await assert.rejects(journal.call('create', { ...record.input, id: randomUUID(), requestKey: 'after-death' }), { code: 'cleanup_blocked' });
    assert.equal((await journal.call('create', record.input)).jobId, record.id);
    verified = true;
  } finally {
    if (holder?.pid && holder.exitCode === null && holder.signalCode === null) {
      const exited = once(holder, 'exit'); holder.kill('SIGKILL'); await exited;
    }
    await journal?.close();
    if (verified) await rm(directory, { recursive: true, force: true });
    else console.error('Maintenance holder-death fixture preserved: recovery not verified');
  }
});
