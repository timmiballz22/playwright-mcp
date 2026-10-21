import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { JobJournal, supportsJournal } from './journal.mjs';
if (supportsJournal) test('bounded writer contention waits before one mutation without replay', { timeout: 10000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'journal-contention-'));
  let journal; let holder; let exited; let timer;
  try {
    journal = await JobJournal.open({ directory, projectId: '1'.repeat(64), ownerId: 'owner' });
    holder = fork(fileURLToPath(new URL('./fixtures/hold-write.mjs', import.meta.url)), [path.join(directory, 'jobs.sqlite')], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: [] });
    exited = once(holder, 'exit');
    const [ready] = await once(holder, 'message'); assert.equal(ready.locked, true);
    const request = { id: randomUUID(), requestKey: randomUUID(), workflowDigest: '2'.repeat(64), total: 1, deadlineAt: Date.now() + 10000 };
    timer = setTimeout(() => { if (holder.connected) holder.send({ release: true }); }, 450);
    const started = performance.now();
    const row = await journal.call('create', request);
    assert.equal(row.state, 'QUEUED'); assert.ok(performance.now() - started >= 400);
    const again = await journal.call('create', { ...request, id: randomUUID() });
    assert.equal(again.jobId, row.jobId);
    assert.equal((await journal.call('list')).length, 1);
    assert.equal((await journal.call('events', { id: row.jobId })).length, 3);
    assert.deepEqual(await journal.call('integrity'), { ok: true });
  } finally {
    clearTimeout(timer);
    if (holder?.connected) holder.send({ release: true });
    if (exited) await exited;
    await journal?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
