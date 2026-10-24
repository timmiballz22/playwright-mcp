import { JobJournal } from '/workspace/playwright-mcp/local-batch/jobs/journal.mjs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
const directory = await mkdtemp(path.join(os.tmpdir(), 'warm-journal-observation-'));
const clients = []; let verified = false;
const config = { directory, projectId: '9'.repeat(64), ownerId: 'owned-warm-probe' };
try {
  const initial = await JobJournal.open(config); clients.push(initial);
  const before = await readFile(path.join(directory, 'jobs.sqlite-wal'));
  const reopened = await JobJournal.open(config); clients.push(reopened);
  const after = await readFile(path.join(directory, 'jobs.sqlite-wal'));
  const integrity = await reopened.call('integrity');
  if (integrity.ok !== true || (await reopened.call('list')).length !== 0) throw new Error('warm_open_semantics_failed');
  const closed = await Promise.allSettled(clients.map(client => client.close()));
  if (!closed.every(item => item.status === 'fulfilled') || !clients.every(client => client.exitConfirmed === true)) throw new Error('warm_open_worker_exit_unconfirmed');
  console.log(JSON.stringify({ fixture: 'warm_journal_wal_observation', beforeBytes: before.length, afterBytes: after.length,
    equalBytes: before.equals(after), beforeHash: createHash('sha256').update(before).digest('hex'),
    afterHash: createHash('sha256').update(after).digest('hex'), actualJournalExitsConfirmed: clients.length, integrity: true, emptyList: true }));
  verified = true;
} finally {
  if (!verified) {
    await Promise.allSettled(clients.map(client => client.close()));
    console.error('Warm journal observation preserved: acceptance or cleanup not confirmed');
  } else await rm(directory, { recursive: true, force: true });
}
