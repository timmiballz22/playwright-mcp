import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const target = process.argv[2];
const { JobJournal, supportsJournal } = await import(pathToFileURL(path.join(target, 'local-batch/jobs/journal.mjs')).href);
if (supportsJournal) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'installed-journal-'));
  const clients = [];
  try {
    const config = { directory, projectId: createHash('sha256').update('installed-fixture').digest('hex') };
    const owner = await JobJournal.open({ ...config, ownerId: 'installed-owner' }); clients.push(owner);
    const other = await JobJournal.open({ ...config, ownerId: 'other-owner' }); clients.push(other);
    const data = { id: randomUUID(), requestKey: 'installed-request', workflowDigest: 'a'.repeat(64), total: 1, deadlineAt: Date.now() + 30000 };
    const job = await owner.call('create', data);
    assert.equal((await owner.call('create', { ...data, id: randomUUID() })).jobId, job.jobId);
    await assert.rejects(other.call('read', { id: job.jobId }), { code: 'not_found' });
    assert.equal((await owner.call('cancel', { id: job.jobId })).state, 'CANCELLED');
    const active = await owner.call('create', { ...data, id: randomUUID(), requestKey: 'installed-result' });
    const nonce = randomUUID();
    assert.equal((await owner.call('reserve', { id: active.jobId, nonce })).acquired, true);
    await owner.call('activate', { id: active.jobId, nonce });
    const summary = { ok: true, completed: 1, total: 1, browser: 'chromium', completionCertainty: 'exact' };
    await owner.call('finish', { id: active.jobId, nonce, state: 'SUCCEEDED', completed: 1, cleanupOk: true, summary });
    assert.deepEqual(await owner.call('result', { id: active.jobId }), summary);
    await assert.rejects(other.call('result', { id: active.jobId }), { code: 'not_found' });
    assert.deepEqual(await owner.call('integrity'), { ok: true });
    process.stdout.write(JSON.stringify({ entry: 'local-batch/jobs/journal.mjs', storageKernel: true, ownerIsolation: true, production: true }) + '\n');
  } finally {
    await Promise.allSettled(clients.map(client => client.close()));
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
