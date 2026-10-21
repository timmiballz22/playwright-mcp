import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir, stat, writeFile, mkdir, symlink, link, chmod } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { JobJournal, supportsJournal } from './journal.mjs';

if (!supportsJournal) {
  test('durable journal explicitly requires Node 22.13 or later', async () => {
    await assert.rejects(JobJournal.open({}), { code: 'unsupported_runtime' });
  });
} else {
  test('managed directory links and database hardlinks cannot modify another file', { timeout: 10000 }, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'journal-paths-'));
    try {
      const target = path.join(root, 'foreign'); await mkdir(target, { mode: 0o700 });
      const marker = path.join(target, 'marker'); await writeFile(marker, 'owned-fixture');
      const alias = path.join(root, 'alias');
      await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir');
      await assert.rejects(JobJournal.open({ directory: alias, projectId: '5'.repeat(64), ownerId: 'owner' }), { code: 'unsafe_store' });
      assert.deepEqual(await readdir(target), ['marker']);
      const directory = path.join(root, 'managed'); await mkdir(directory, { mode: 0o700 });
      await link(marker, path.join(directory, 'jobs.sqlite'));
      await assert.rejects(JobJournal.open({ directory, projectId: '5'.repeat(64), ownerId: 'owner' }), { code: 'unsafe_store' });
      assert.equal(await readFile(marker, 'utf8'), 'owned-fixture');
      const keyRoot = path.join(root, 'key-managed'); await mkdir(keyRoot, { mode: 0o700 });
      const outsideKey = path.join(root, 'foreign-key'); await writeFile(outsideKey, Buffer.alloc(32, 7), { mode: 0o600 });
      await link(outsideKey, path.join(keyRoot, 'journal.key'));
      await assert.rejects(JobJournal.open({ directory: keyRoot, projectId: '5'.repeat(64), ownerId: 'owner' })
          .then(async unexpected => { await unexpected.close(); return undefined; }), { code: 'unsafe_store' });
      assert.deepEqual(await readFile(outsideKey), Buffer.alloc(32, 7));
      assert.deepEqual(await readdir(keyRoot), ['journal.key']);

    } finally { await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });

  if (process.platform !== 'win32') {
    test('POSIX journal directory must exclude group and other access', async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), 'journal-mode-'));
      try {
        await chmod(directory, 0o755);
        await assert.rejects(JobJournal.open({ directory, projectId: '6'.repeat(64), ownerId: 'owner' }), { code: 'unsafe_store' });
        assert.deepEqual(await readdir(directory), []);
      } finally { await rm(directory, { recursive: true, force: true }); }
    });
  }
  test('a simulated reused PID cannot resume old work or clear uncertain active resources', { timeout: 10000 }, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'journal-pid-reuse-'));
    const clients = [];
    try {
      const config = { directory, projectId: '3'.repeat(64), ownerId: 'owner' };
      const old = await JobJournal.open({ ...config, instanceId: randomUUID() }); clients.push(old);
      const current = await JobJournal.open({ ...config, instanceId: randomUUID() }); clients.push(current);
      const create = journal => journal.call('create', { id: randomUUID(), requestKey: randomUUID(), workflowDigest: '4'.repeat(64), total: 1, deadlineAt: Date.now() + 30000 });
      const queued = await create(old);
      await current.call('recover');
      assert.equal((await current.call('read', { id: queued.jobId })).state, 'CRASHED');
      const active = await create(old);
      const nonce = randomUUID();
      await old.call('reserve', { id: active.jobId, nonce });
      await old.call('activate', { id: active.jobId, nonce });
      const recovered = await current.call('recover');
      assert.equal(recovered.cleanupBlocked, true);
      assert.equal((await current.call('read', { id: active.jobId })).operatorAttentionRequired, true);
      const next = await create(current);
      assert.deepEqual(await current.call('reserve', { id: next.jobId, nonce: randomUUID() }), { acquired: false, reason: 'cleanup_blocked' });
      await assert.rejects(old.call('finish', { id: active.jobId, nonce, state: 'SUCCEEDED', completed: 1, cleanupOk: true }), { code: 'invalid_transition' });
    } finally { await Promise.allSettled(clients.map(client => client.close())); await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });
  test('cancelled reservations never start and uncertain active cancellation keeps the project blocked', { timeout: 10000 }, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'journal-cancel-states-'));
    let journal;
    try {
      journal = await JobJournal.open({ directory, projectId: '7'.repeat(64), ownerId: 'owner' });
      const create = (deadlineAt = Date.now() + 30000) => journal.call('create', {
        id: randomUUID(), requestKey: randomUUID(), workflowDigest: '8'.repeat(64), total: 3, deadlineAt,
      });
      const expired = await create(Date.now() - 1);
      assert.equal(expired.state, 'TIMED_OUT');
      assert.equal(expired.completed, 0);
      assert.equal(expired.completionCertainty, 'exact');
      const reserved = await create();
      const firstNonce = randomUUID();
      assert.equal((await journal.call('reserve', { id: reserved.jobId, nonce: firstNonce })).acquired, true);
      const intent = await journal.call('cancel', { id: reserved.jobId });
      assert.equal(intent.state, 'QUEUED');
      assert.equal(intent.cancelRequested, true);
      const stopped = await journal.call('activate', { id: reserved.jobId, nonce: firstNonce });
      assert.equal(stopped.state, 'CANCELLED');
      assert.equal(stopped.completed, 0);
      assert.equal(stopped.completionCertainty, 'exact');
      assert.deepEqual(await journal.call('cancel', { id: reserved.jobId }), stopped);
      const active = await create();
      const nonce = randomUUID();
      assert.equal((await journal.call('reserve', { id: active.jobId, nonce })).acquired, true);
      await journal.call('activate', { id: active.jobId, nonce });
      await journal.call('progress', { id: active.jobId, nonce, completed: 1 });
      assert.equal((await journal.call('cancel', { id: active.jobId })).state, 'RUNNING');
      await assert.rejects(journal.call('finish', { id: active.jobId, nonce, state: 'SUCCEEDED', completed: 3, cleanupOk: true }), { code: 'invalid_transition' });
      assert.equal((await journal.call('read', { id: active.jobId })).state, 'RUNNING');
      const finished = await journal.call('finish', { id: active.jobId, nonce, state: 'CANCELLED', completed: 1, cleanupOk: false });
      assert.equal(finished.operatorAttentionRequired, true);
      assert.equal(finished.retrySafe, false);
      assert.equal(finished.completionCertainty, 'confirmed_lower_bound');
      assert.deepEqual(await journal.call('cancel', { id: active.jobId }), finished);
      assert.equal((await journal.call('recover')).cleanupBlocked, true);
      const request = { id: randomUUID(), requestKey: randomUUID(), workflowDigest: '8'.repeat(64), total: 3, deadlineAt: Date.now() + 30000 };
      await assert.rejects(journal.call('create', { ...request, requireCleanLease: true }), { code: 'cleanup_blocked' });
      const next = await journal.call('create', request);
      assert.equal((await journal.call('create', { ...request, id: randomUUID(), requireCleanLease: true, admitNew: false })).jobId, next.jobId);
      await assert.rejects(journal.call('create', { ...request, requireCleanLease: 'false' }), { code: 'invalid_metadata' });
      assert.deepEqual(await journal.call('reserve', { id: next.jobId, nonce: randomUUID() }), { acquired: false, reason: 'cleanup_blocked' });
      assert.deepEqual(await journal.call('integrity'), { ok: true });
    } finally { await journal?.close(); await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });
  test('a success mutation after the persisted deadline cannot commit or release the lease', { timeout: 10000 }, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'journal-finish-deadline-'));
    let journal;
    try {
      journal = await JobJournal.open({ directory, projectId: '9'.repeat(64), ownerId: 'owner',
        workerModule: new URL('./fixtures/deadline-finish.mjs', import.meta.url) });
      const job = await journal.call('create', { id: randomUUID(), requestKey: randomUUID(), workflowDigest: 'a'.repeat(64), total: 1, deadlineAt: Date.now() + 30000 });
      const nonce = randomUUID();
      await journal.call('reserve', { id: job.jobId, nonce });
      await journal.call('activate', { id: job.jobId, nonce });
      await assert.rejects(journal.call('finish', { id: job.jobId, nonce, state: 'SUCCEEDED', completed: 1, cleanupOk: true }), { code: 'invalid_transition' });
      assert.equal((await journal.call('read', { id: job.jobId })).state, 'RUNNING');
      const failed = await journal.call('finish', { id: job.jobId, nonce, state: 'TIMED_OUT', completed: 1, cleanupOk: true });
      assert.equal(failed.state, 'TIMED_OUT');
      assert.equal(failed.retrySafe, false);
      assert.deepEqual(await journal.call('integrity'), { ok: true });
    } finally { await journal?.close(); await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });
  test('competing writers initialize consistently and cannot overfill the project queue', { timeout: 15000 }, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'journal-competing-'));
    const clients = [];
    try {
      await Promise.all(['owner-a', 'owner-b'].map(async ownerId => {
        clients.push(await JobJournal.open({ directory, projectId: '1'.repeat(64), ownerId }));
      }));
      const submitted = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => clients[index % 2].call('create', {
        id: randomUUID(), requestKey: 'concurrent-' + index, workflowDigest: '2'.repeat(64), total: 1, deadlineAt: Date.now() + 30000,
      })));
      assert.ok(submitted.filter(result => result.status === 'fulfilled').length <= 8);
      for (const result of submitted) if (result.status === 'rejected') assert.ok(['queue_full', 'journal_busy'].includes(result.reason.code));
      const count = (await clients[0].call('list')).length + (await clients[1].call('list')).length;
      assert.ok(count > 0 && count <= 8);
      assert.deepEqual(await clients[0].call('integrity'), { ok: true });
    } finally { await Promise.allSettled(clients.map(client => client.close())); await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });
  test('killed transaction rolls back without a partial job or duplicate request', { timeout: 15000 }, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'journal-rollback-'));
    const config = { directory, projectId: 'b'.repeat(64), ownerId: 'owner' };
    let journal;
    try {
      journal = await JobJournal.open({ ...config, workerModule: new URL('./fixtures/transaction-fault.mjs', import.meta.url) });
      journal.timeoutMs = 100;
      const id = randomUUID();
      const pending = journal.call('create', { id, requestKey: 'one-request', workflowDigest: 'c'.repeat(64), total: 2, deadlineAt: Date.now() + 30000 })
        .then(() => 'unexpected_success', exception => exception.code);
      assert.equal(await pending, 'journal_unavailable');
      await journal.exited;
      assert.equal((await stat(path.join(directory, 'transaction-paused'))).isFile(), true);
      journal = await JobJournal.open(config);
      assert.deepEqual(await journal.call('integrity'), { ok: true });
      assert.deepEqual(await journal.call('list'), []);
      await assert.rejects(journal.call('read', { id }), { code: 'not_found' });
      const created = await journal.call('create', { id, requestKey: 'one-request', workflowDigest: 'c'.repeat(64), total: 2, deadlineAt: Date.now() + 30000 });
      assert.equal(created.jobId, id);
    } finally { await journal?.close(); await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });

  test('reconnect marks a dead controller queued job crashed and never requeues its request', { timeout: 15000 }, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'journal-recovery-'));
    const projectId = 'd'.repeat(64);
    const child = spawn(process.execPath, [fileURLToPath(new URL('./fixtures/queued-owner.mjs', import.meta.url)), directory, projectId], { stdio: ['ignore', 'pipe', 'ignore'] });
    const exited = once(child, 'exit');
    const lines = createInterface({ input: child.stdout });
    let journal;
    let timer;
    try {
      const record = await Promise.race([new Promise(resolve => lines.once('line', line => resolve(JSON.parse(line)))),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Queued fixture did not start')), 5000); })]);
      clearTimeout(timer); child.kill('SIGKILL'); await exited;
      journal = await JobJournal.open({ directory, projectId, ownerId: 'recovery-owner' });
      assert.equal((await journal.call('recover')).recovered, 1);
      const status = await journal.call('read', { id: record.jobId });
      assert.equal(status.state, 'CRASHED');
      assert.equal(status.completed, 0);
      assert.equal(status.retrySafe, false);
      const repeated = await journal.call('create', { id: randomUUID(), requestKey: 'recovery-request', workflowDigest: 'a'.repeat(64), total: 1, deadlineAt: Date.now() + 30000 });
      assert.equal(repeated.jobId, record.jobId);
      assert.equal(repeated.state, 'CRASHED');
    } finally { clearTimeout(timer); child.kill('SIGKILL'); lines.close(); await journal?.close(); await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });

  test('corrupt journal is rejected without silently erasing the file', { timeout: 10000 }, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'journal-corrupt-'));
    const config = { directory, projectId: 'e'.repeat(64), ownerId: 'owner' };
    try {
      const journal = await JobJournal.open(config); await journal.close();
      const marker = Buffer.from('owned-corrupt-fixture');
      await writeFile(path.join(directory, 'jobs.sqlite'), marker);
      await assert.rejects(JobJournal.open(config), { code: 'journal_corrupt' });
      assert.deepEqual(await readFile(path.join(directory, 'jobs.sqlite')), marker);
    } finally { await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });

  test('an unrelated SQLite file is rejected without changing its bytes', { timeout: 10000 }, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'journal-foreign-'));
    let unexpected;
    try {
      const filename = path.join(directory, 'jobs.sqlite');
      await writeFile(filename, '', { mode: 0o600, flag: 'wx' });
      const { DatabaseSync } = await import('node:sqlite');
      const foreign = new DatabaseSync(filename);
      foreign.exec("CREATE TABLE unrelated (value TEXT); INSERT INTO unrelated VALUES ('owned-other-app-fixture')");
      foreign.close();
      const original = await readFile(filename);
      await assert.rejects(async () => { unexpected = await JobJournal.open({ directory, projectId: 'f'.repeat(64), ownerId: 'owner' }); }, { code: 'store_identity_mismatch' });
      assert.deepEqual(await readFile(filename), original);
    } finally { await unexpected?.close(); await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });

  test('journal preserves idempotency, owner isolation and a single project execution lease', { timeout: 15000 }, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'journal spaces-'));
    const projectId = createHash('sha256').update('project-fixture').digest('hex');
    const clients = [];
    const open = async ownerId => {
      const client = await JobJournal.open({ directory, projectId, ownerId }); clients.push(client); return client;
    };
    const request = (id, requestKey, total = 3) => ({ id, requestKey, total, deadlineAt: Date.now() + 30000,
      workflowDigest: createHash('sha256').update('fake-workflow-secret-canary').digest('hex') });
    try {
      const a = await open('owner-a');
      const b = await open('owner-b');
      const id = randomUUID();
      await assert.rejects(a.call('create', { ...request(id, 'one'), workflow: { secret: 'fake-workflow-secret-canary' } }), { code: 'invalid_metadata' });
      const created = await a.call('create', request(id, 'fake-request-secret-canary'));
      assert.equal(created.jobId, id);
      assert.equal(created.state, 'QUEUED');
      assert.deepEqual(await a.call('verify', { id, workflowDigest: request(id, 'unused').workflowDigest }), { verified: true });
      await assert.rejects(a.call('verify', { id, workflowDigest: 'f'.repeat(64) }), { code: 'idempotency_conflict' });
      await assert.rejects(b.call('verify', { id, workflowDigest: request(id, 'unused').workflowDigest }), { code: 'not_found' });
      const duplicate = await a.call('create', request(randomUUID(), 'fake-request-secret-canary'));
      assert.equal(duplicate.jobId, id);
      await assert.rejects(b.call('read', { id }), { code: 'not_found' });
      await assert.rejects(b.call('cancel', { id }), { code: 'not_found' });
      await assert.rejects(a.call('create', { ...request(randomUUID(), 'fake-request-secret-canary'), workflowDigest: 'a'.repeat(64) }), { code: 'idempotency_conflict' });
      const nonce = randomUUID();
      assert.equal((await a.call('reserve', { id, nonce })).acquired, true);
      const second = await b.call('create', request(randomUUID(), 'b-request'));
      assert.deepEqual(await b.call('reserve', { id: second.jobId, nonce: randomUUID() }), { acquired: false, reason: 'project_busy' });
      await assert.rejects(a.call('activate', { id, nonce: randomUUID() }), { code: 'invalid_lease' });
      await a.call('activate', { id, nonce });
      await a.call('progress', { id, nonce, completed: 2 });
      await assert.rejects(a.call('finish', { id, nonce, state: 'FAILED', completed: 2, cleanupOk: true,
        summary: { ok: false, completed: 2, total: 3, recentSteps: [{ index: 3, type: 'fake-workflow-secret-canary', ok: false, error: 'action_failed' }] } }), { code: 'invalid_metadata' });
      await assert.rejects(a.call('finish', { id, nonce, state: 'FAILED', completed: 2, cleanupOk: true,
        summary: { ok: false, completed: 2, total: 3, recentSteps: [{ index: 3, type: 'click', ok: false, error: 'fake-workflow-secret-canary' }] } }), { code: 'invalid_metadata' });
      for (const injected of [
        { browser: 'fake-workflow-secret-canary' }, { stage: 'fake-workflow-secret-canary' },
        { reportPath: 'fake-workflow-secret-canary' }, { reportId: 'fake-workflow-secret-canary' }, { runId: 'fake-workflow-secret-canary' },
        { execution: { mode: 'fake-workflow-secret-canary' } },
        { execution: { browserPids: ['fake-workflow-secret-canary'] } },
        { recentSteps: [{ index: 3, type: 'click', ok: false, durationMs: 'fake-workflow-secret-canary' }] },
        { recentSteps: [{ index: 3, type: 'screenshot', ok: true, artifact: 'fake-workflow-secret-canary' }] },
      ]) {
        await assert.rejects(a.call('finish', { id, nonce, state: 'FAILED', completed: 2, cleanupOk: true,
          summary: { ok: false, completed: 2, total: 3, ...injected } }), { code: 'invalid_metadata' });
      }
      await assert.rejects(a.call('progress', { id, nonce, completed: 1 }), { code: 'invalid_progress' });
      await assert.rejects(a.call('finish', { id, nonce, state: 'SUCCEEDED', completed: 2, cleanupOk: true }), { code: 'invalid_transition' });
      const safeSummary = { schemaVersion: 1, runId: randomUUID(), ok: true, reason: null,
        browser: 'chromium', completed: 3, total: 3, durationMs: 100, blockedRequests: 0,
        completionCertainty: 'exact', actionsSucceeded: true, failedStep: null,
        recentSteps: [{ index: 3, repetition: 1, type: 'click', ok: true, durationMs: 2 }],
        execution: { mode: 'supervised', forced: false, cleanup: 'terminated', tempCleanup: 'removed',
          supervisorPid: process.pid, workerPid: process.pid, browserPids: [] } };
      await a.call('finish', { id, nonce, state: 'SUCCEEDED', completed: 3, cleanupOk: true, summary: safeSummary });
      assert.deepEqual(await a.call('result', { id }), safeSummary);
      const final = await a.call('read', { id });
      assert.equal(final.state, 'SUCCEEDED');
      assert.equal(final.completed, 3);
      await assert.rejects(a.call('reserve', { id, nonce }), { code: 'invalid_transition' });
      const cancelled = await b.call('cancel', { id: second.jobId });
      assert.equal(cancelled.state, 'CANCELLED');
      assert.deepEqual(await b.call('cancel', { id: second.jobId }), cancelled);
      assert.equal((await a.call('list')).length, 1);
      const events = await a.call('events', { id });
      assert.deepEqual(events.slice(0, 3).map(event => event.state), ['CREATED', 'VALIDATING', 'QUEUED']);
      await a.close();
      const reopened = await open('owner-a');
      assert.equal((await reopened.call('read', { id })).state, 'SUCCEEDED');
      for (const name of await readdir(directory)) {
        const data = await readFile(path.join(directory, name));
        assert.equal(data.includes(Buffer.from('fake-workflow-secret-canary')), false, 'Workflow input persisted');
        assert.equal(data.includes(Buffer.from('fake-request-secret-canary')), false, 'Request key persisted in plaintext');
      }
    } finally {
      await Promise.allSettled(clients.map(client => client.close()));
      await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
}

if (supportsJournal) test('monotonic queue expiry cannot release another execution lease or cross creator/owner boundaries', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'journal-queue-clock-'));
  const config = { directory, projectId: '8'.repeat(64), ownerId: 'owner' };
  let journal; let foreign; let other;
  try {
    journal = await JobJournal.open(config);
    const create = key => journal.call('create', { id: randomUUID(), requestKey: key, workflowDigest: key.repeat(64), total: 1, deadlineAt: Date.now() + 15000 });
    const active = await create('a'); const nonce = randomUUID();
    await journal.call('reserve', { id: active.jobId, nonce }); await journal.call('activate', { id: active.jobId, nonce });
    const queued = await create('b');
    foreign = await JobJournal.open({ ...config, ownerId: 'foreign' });
    await assert.rejects(foreign.call('reserve', { id: queued.jobId, nonce: randomUUID(), queueExpired: true }), { code: 'not_found' });
    other = await JobJournal.open({ ...config, instanceId: randomUUID() });
    await assert.rejects(other.call('reserve', { id: queued.jobId, nonce: randomUUID(), queueExpired: true }), { code: 'invalid_transition' });
    await assert.rejects(journal.call('reserve', { id: queued.jobId, nonce: randomUUID(), queueExpired: 'yes' }), { code: 'invalid_metadata' });
    assert.equal((await journal.call('reserve', { id: queued.jobId, nonce: randomUUID(), queueExpired: true })).reason, 'not_started');
    assert.equal((await journal.call('read', { id: queued.jobId })).state, 'TIMED_OUT');
    const third = await create('c');
    assert.equal((await journal.call('reserve', { id: third.jobId, nonce: randomUUID() })).reason, 'project_busy');
    assert.equal((await journal.call('read', { id: active.jobId })).state, 'RUNNING');
    await journal.call('finish', { id: active.jobId, nonce, state: 'CANCELLED', completed: 0, cleanupOk: true });
    assert.equal((await journal.call('reserve', { id: third.jobId, nonce: randomUUID() })).acquired, true);
  } finally {
    await Promise.allSettled([journal?.close(), foreign?.close(), other?.close()]);
    await rm(directory, { recursive: true, force: true });
  }
});
