import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, realpath, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { JobController } from './controller.mjs';
import { JobJournal, JournalError, supportsJournal } from './journal.mjs';
import { resolveJobConfig } from './config.mjs';
import { captureWorkflow } from './workflow-snapshot.mjs';

test('retention preview/delete rechecks age and preserves fresh or uncertain artifacts', async () => {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'retention-scope-')));
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const runs = ids.map(() => randomUUID());
  const old = new Date(Date.now() - 2 * 86400000).toISOString();
  const rows = ids.map((jobId, index) => ({ jobId, state: 'SUCCEEDED', resultAvailable: true,
    updatedAt: index === 1 ? new Date().toISOString() : old, operatorAttentionRequired: index === 2 }));
  const calls = [];
  const journal = { call: async (command, data) => {
    calls.push(command);
    if (command === 'recover') return { cleanupBlocked: false };
    if (command === 'retention') return { jobs: ids.map(jobId => ({ jobId, updatedAt: old })), hasMore: false };
    const index = ids.indexOf(data.id); assert.ok(index >= 0);
    if (command === 'read') return rows[index];
    assert.equal(command, 'result'); assert.equal(index, 0, 'Unsafe/newly fresh rows must stop before reading their execution scope');
    return { runId: runs[index] };
  } };
  const controller = new JobController(journal, {}, { artifactsDir: base });
  try {
    for (const runId of runs) {
      await mkdir(path.join(base, 'exec-' + runId), { mode: 0o700 });
      await writeFile(path.join(base, 'exec-' + runId, 'marker'), 'private marker', { mode: 0o600 });
    }
    const preview = await controller.pruneArtifacts({ olderThanDays: 1 });
    assert.equal(preview.dryRun, true); assert.equal(preview.results[0].files, 1);
    assert.equal(await readFile(path.join(base, 'exec-' + runs[0], 'marker'), 'utf8'), 'private marker');
    assert.deepEqual(preview.results.slice(1).map(result => result.code), ['not_expired', 'cleanup_blocked']);
    assert.equal(preview.operatorAttentionRequired, true, 'A newly observed uncertain row must remain visible');
    const deleted = await controller.pruneArtifacts({ olderThanDays: 1, dryRun: false });
    assert.equal(deleted.results[0].removed, true);
    await assert.rejects(readFile(path.join(base, 'exec-' + runs[0], 'marker')), { code: 'ENOENT' });
    for (const runId of runs.slice(1)) assert.equal(await readFile(path.join(base, 'exec-' + runId, 'marker'), 'utf8'), 'private marker');
    assert.equal(deleted.nextAfterJobId, ids[2]); assert.equal(deleted.hasMore, false);
    assert.equal(rows[0].state, 'SUCCEEDED', 'Artifact retention must not erase durable results or request keys');
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('invalid or pre-aborted retention does not query storage', async () => {
  let calls = 0;
  const controller = new JobController({ call: async () => { calls++; throw new Error('fake-private-storage-canary'); } }, {}, { artifactsDir: '/must-not-be-read' });
  for (const options of [{ olderThanDays: 0 }, { olderThanDays: 3651 }, { olderThanDays: 1, limit: 11 }, { olderThanDays: 1, dryRun: 'false' }])
    await assert.rejects(controller.pruneArtifacts(options), { code: 'invalid_metadata' });
  const abort = new AbortController(); abort.abort();
  const result = await controller.pruneArtifacts({ olderThanDays: 1, signal: abort.signal });
  assert.equal(result.interrupted, true); assert.deepEqual(result.results, []); assert.equal(result.hasMore, null);
  assert.equal(calls, 0);
});

test('retention interruption completes one authorized scope and preserves the continuation', async () => {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'retention-abort-')));
  const ids = [randomUUID(), randomUUID()]; const runs = ids.map(() => randomUUID());
  const abort = new AbortController(); const old = new Date(Date.now() - 2 * 86400000).toISOString();
  const controller = new JobController({ call: async (command, data) => {
    if (command === 'recover') return { cleanupBlocked: false };
    if (command === 'retention') return { jobs: ids.map(jobId => ({ jobId })), hasMore: false };
    assert.equal(data.id, ids[0], 'Interruption must stop before opening the second scope');
    if (command === 'read') return { state: 'SUCCEEDED', updatedAt: old, resultAvailable: true };
    assert.equal(command, 'result'); abort.abort(); return { runId: runs[0] };
  } }, {}, { artifactsDir: base });
  try {
    for (const runId of runs) { await mkdir(path.join(base, 'exec-' + runId)); await writeFile(path.join(base, 'exec-' + runId, 'marker'), 'keep'); }
    const result = await controller.pruneArtifacts({ olderThanDays: 1, dryRun: false, signal: abort.signal });
    assert.equal(result.interrupted, true); assert.equal(result.hasMore, true);
    assert.equal(result.results.length, 1); assert.equal(result.nextAfterJobId, ids[0]);
    await assert.rejects(readFile(path.join(base, 'exec-' + runs[0], 'marker')), { code: 'ENOENT' });
    assert.equal(await readFile(path.join(base, 'exec-' + runs[1], 'marker'), 'utf8'), 'keep');
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('artifact retention never conceals a blocked project even when no old artifacts qualify', async () => {
  const commands = [];
  const controller = new JobController({ call: async command => {
    commands.push(command);
    if (command === 'recover') return { cleanupBlocked: true };
    assert.equal(command, 'retention'); return { jobs: [], hasMore: false };
  } }, {}, { artifactsDir: '/must-not-be-read' });
  const result = await controller.pruneArtifacts({ olderThanDays: 7, dryRun: false });
  assert.equal(result.operatorAttentionRequired, true); assert.deepEqual(result.results, []);
  assert.deepEqual(commands, ['recover', 'retention']);
});

test('retention stops on lost journal transport without touching later scopes', async () => {
  const ids = [randomUUID(), randomUUID()]; const commands = [];
  const controller = new JobController({ call: async (command, data) => {
    commands.push(command);
    if (command === 'recover') return { cleanupBlocked: false };
    if (command === 'retention') return { jobs: ids.map(jobId => ({ jobId })), hasMore: false };
    assert.equal(command, 'read'); assert.equal(data.id, ids[0]); throw new JournalError('journal_unavailable');
  } }, {}, { artifactsDir: '/must-not-be-read' });
  const result = await controller.pruneArtifacts({ olderThanDays: 1, dryRun: false });
  assert.deepEqual(commands, ['recover', 'retention', 'read']);
  assert.equal(result.results.length, 1); assert.equal(result.results[0].code, 'journal_unavailable');
  assert.equal(result.hasMore, true); assert.equal(result.nextAfterJobId, ids[0]);
  assert.equal(result.operatorAttentionRequired, true);
});

if (supportsJournal) test('read-only retention pages reach old owner jobs beyond recent twenty and retain uncertain leases', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'retention-pages-')));
  const config = { directory, projectId: 'e'.repeat(64), ownerId: randomUUID() };
  let journal; let foreign;
  try {
    journal = await JobJournal.open(config);
    const cancelled = async (client, key) => {
      const id = randomUUID();
      await client.call('create', { id, requestKey: key, workflowDigest: 'a'.repeat(64), total: 1, deadlineAt: Date.now() + 60000 });
      await client.call('cancel', { id }); return id;
    };
    const oldIds = [];
    for (let index = 0; index < 25; index++) oldIds.push(await cancelled(journal, 'old-' + index));
    for (let index = 0; index < 21; index++) await cancelled(journal, 'fresh-' + index);
    foreign = await JobJournal.open({ ...config, ownerId: randomUUID() });
    const foreignId = await cancelled(foreign, 'fake-foreign-key-canary');
    const activeId = randomUUID();
    await journal.call('create', { id: activeId, requestKey: 'active', workflowDigest: 'b'.repeat(64), total: 1, deadlineAt: Date.now() + 60000 });
    const uncertainId = randomUUID(); const nonce = randomUUID();
    await journal.call('create', { id: uncertainId, requestKey: 'uncertain', workflowDigest: 'c'.repeat(64), total: 1, deadlineAt: Date.now() + 60000 });
    assert.equal((await journal.call('reserve', { id: uncertainId, nonce })).acquired, true);
    await journal.call('activate', { id: uncertainId, nonce });
    await journal.call('finish', { id: uncertainId, nonce, state: 'CRASHED', completed: 0, cleanupOk: false });
    await foreign.close(); foreign = undefined; await journal.close(); journal = undefined;
    // Age only this private fixture's metadata, avoiding a day-long wall wait.
    const db = new DatabaseSync(path.join(directory, 'jobs.sqlite'));
    try {
      const update = db.prepare('UPDATE jobs SET created_at=?,updated_at=?,deadline_at=? WHERE id=?');
      const events = db.prepare('UPDATE events SET created_at=?-((SELECT revision FROM jobs WHERE id=?)-revision) WHERE job_id=?');
      let stamp = Date.now() - 2 * 86400000;
      for (const id of [...oldIds, foreignId, activeId, uncertainId]) {
        update.run(stamp - 1000, stamp, stamp + 60000, id); events.run(stamp, id, id); stamp++;
      }
      assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
    } finally { db.close(); }
    journal = await JobJournal.open(config);
    assert.equal((await journal.call('list', { limit: 20 })).some(job => oldIds.includes(job.jobId)), false);
    const before = await journal.call('events', { id: oldIds[0] });
    const found = []; let afterId;
    do {
      const page = await journal.call('retention', { beforeMs: Date.now() - 86400000, limit: 10, ...(afterId ? { afterId } : {}) });
      assert.ok(page.jobs.length <= 10);
      assert.equal(JSON.stringify(page).includes(directory), false);
      assert.equal(JSON.stringify(page).includes('fake-foreign-key-canary'), false);
      found.push(...page.jobs.map(job => job.jobId));
      if (!page.hasMore) break;
      afterId = page.jobs.at(-1).jobId;
    } while (true);
    assert.deepEqual(found, oldIds);
    assert.deepEqual(await journal.call('events', { id: oldIds[0] }), before);
    assert.equal((await journal.call('read', { id: activeId })).state, 'QUEUED', 'Selection must not run recovery or change active state');
    assert.equal((await journal.call('read', { id: uncertainId })).operatorAttentionRequired, true);
    await assert.rejects(journal.call('retention', { beforeMs: Date.now(), afterId: foreignId }), { code: 'not_found' });
    await assert.rejects(journal.call('retention', { beforeMs: Date.now(), afterId: activeId }), { code: 'invalid_metadata' });
    for (const patch of [{ beforeMs: Date.now() + 60000 }, { limit: 11 }, { limit: 0 }])
      await assert.rejects(journal.call('retention', { beforeMs: Date.now() - 86400000, ...patch }), { code: 'invalid_metadata' });
    await assert.rejects(journal.call('create', { id: randomUUID(), requestKey: 'must-stay-blocked', workflowDigest: 'd'.repeat(64), total: 1,
      deadlineAt: Date.now() + 60000, requireCleanLease: true }), { code: 'cleanup_blocked' });
  } finally { await foreign?.close(); await journal?.close(); await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});

if (supportsJournal) test('actual retention CLI previews/deletes old artifacts and preserves fresh files, results and idempotency', { timeout: 60000 }, async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'retention-cli-')));
  const env = { ...process.env, PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_PROJECT_DIR: root,
    PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'data'), PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: '',
    PLAYWRIGHT_JOBS_ALLOW_MUTATIONS: '0', PLAYWRIGHT_JOBS_ALLOW_SENSITIVE_ARTIFACTS: '0',
    PLAYWRIGHT_JOBS_NAVIGATION_RETRIES: '0', PLAYWRIGHT_JOBS_MAX_PAGES: '8', PLAYWRIGHT_JOBS_MAX_SCREENSHOT_BYTES: '0' };
  let journal; let controller; let verified = false; let primaryFailure;
  try {
    const config = await resolveJobConfig({ env, cwd: root });
    const workflow = { timeoutMs: 10000, steps: [{ type: 'waitFor', selector: '#unused' }] };
    const digest = captureWorkflow(workflow).digest;
    journal = await JobJournal.open(config.journal);
    const records = [];
    for (const key of ['fake-retention-old-key-canary', 'fresh-key']) {
      const id = randomUUID(); const runId = randomUUID(); const nonce = randomUUID();
      await journal.call('create', { id, requestKey: key, workflowDigest: digest, total: 1, deadlineAt: Date.now() + 60000 });
      await journal.call('reserve', { id, nonce }); await journal.call('activate', { id, nonce });
      await journal.call('finish', { id, nonce, state: 'SUCCEEDED', completed: 1, cleanupOk: true,
        summary: { ok: true, completed: 1, total: 1, runId } });
      const scope = path.join(config.execution.artifactsDir, 'exec-' + runId);
      await mkdir(scope, { mode: 0o700 }); await writeFile(path.join(scope, 'marker'), 'fake-private-artifact-canary', { mode: 0o600 });
      records.push({ id, runId, scope });
    }
    await journal.close(); journal = undefined;
    const db = new DatabaseSync(path.join(config.journal.directory, 'jobs.sqlite'));
    try {
      const old = Date.now() - 2 * 86400000;
      db.prepare('UPDATE jobs SET created_at=?,updated_at=?,deadline_at=? WHERE id=?').run(old - 1000, old, old + 60000, records[0].id);
      db.prepare('UPDATE events SET created_at=?-((SELECT revision FROM jobs WHERE id=?)-revision) WHERE job_id=?').run(old, records[0].id, records[0].id);
    } finally { db.close(); }
    const cli = async args => {
      const { stdout } = await promisify(execFile)(process.execPath,
        [fileURLToPath(new URL('../jobs-cli.mjs', import.meta.url)), 'prune-artifacts', '--older-than-days', '1', ...args],
        { env, timeout: 20000, maxBuffer: 262144 });
      for (const secret of [root, env.PLAYWRIGHT_JOBS_OWNER_ID, 'fake-retention-old-key-canary', 'fake-private-artifact-canary'])
        assert.equal(stdout.includes(secret), false, 'Retention CLI leaked configuration, key or artifact content');
      return JSON.parse(stdout);
    };
    const preview = await cli([]);
    assert.equal(preview.dryRun, true); assert.equal(preview.results.length, 1);
    assert.equal(preview.results[0].jobId, records[0].id); assert.equal(preview.results[0].files, 1);
    assert.equal(await readFile(path.join(records[0].scope, 'marker'), 'utf8'), 'fake-private-artifact-canary');
    const deleted = await cli(['--delete']);
    assert.equal(deleted.results[0].removed, true);
    await assert.rejects(readFile(path.join(records[0].scope, 'marker')), { code: 'ENOENT' });
    assert.equal(await readFile(path.join(records[1].scope, 'marker'), 'utf8'), 'fake-private-artifact-canary');
    const events = [];
    controller = await JobController.open({ ...config, onEvent: event => events.push(event) });
    const duplicate = await controller.start(workflow, 'fake-retention-old-key-canary');
    assert.equal(duplicate.jobId, records[0].id); assert.equal(duplicate.state, 'SUCCEEDED');
    assert.equal((await controller.result(duplicate.jobId)).runId, records[0].runId);
    assert.equal((await controller.list()).length, 2);
    assert.equal((await controller.close()).cleanupConfirmed, true); controller = undefined;
    assert.equal(events.some(event => event.type === 'guardianSpawned'), false, 'A retained request key must never replay the workflow');
    verified = true;
  } catch (error) { primaryFailure = error; throw error; }
  finally {
    let cleanupFailure;
    try { await journal?.close(); if (controller) assert.equal((await controller.close()).cleanupConfirmed, true); }
    catch (error) { cleanupFailure = error; }
    if (verified && !cleanupFailure) await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    else console.error('Retention CLI fixture preserved: acceptance or cleanup not confirmed');
    if (cleanupFailure) throw primaryFailure ? new AggregateError([primaryFailure, cleanupFailure], 'Retention fixture and cleanup failed', { cause: primaryFailure }) : cleanupFailure;
  }
});
