import { DatabaseSync } from 'node:sqlite';
import { JobJournal } from '/workspace/playwright-mcp/local-batch/jobs/journal.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const directory = await mkdtemp(path.join(os.tmpdir(), 'schema-race-observation-'));
const config = { directory, projectId: '6'.repeat(64), ownerId: 'owned-race-probe' };
const clients = []; let verified = false;
try {
  const initial = await JobJournal.open(config); clients.push(initial); await initial.close();
  let acceptedUnsupported = false, code = null, rejectedExitConfirmed = null;
  try {
    const raced = await JobJournal.open({ ...config, workerModule: new URL('file:///workspace/playwright-mcp/local-batch/jobs/fixtures/schema-version-race.mjs') });
    clients.push(raced); acceptedUnsupported = true;
  } catch (error) { code = error.code; rejectedExitConfirmed = error.journalExitConfirmed; }
  const db = new DatabaseSync(path.join(directory, 'jobs.sqlite'), { allowExtension: false });
  let version, projectMarkerPresent; try { version = db.prepare('PRAGMA user_version').get().user_version; projectMarkerPresent = db.prepare("SELECT value FROM meta WHERE key='project'").get()?.value === config.projectId; } finally { db.close(); }
  await Promise.all(clients.map(client => client.close()));
  if (!clients.every(client => client.exitConfirmed === true) || !acceptedUnsupported && rejectedExitConfirmed !== true) throw new Error('schema_race_exit_unconfirmed');
  console.log(JSON.stringify({ fixture: 'real_schema_version_race', acceptedUnsupported, errorCode: code, versionAfter: version, projectMarkerPresent,
    returnedClientExitsConfirmed: clients.length, rejectedWorkerExitConfirmed: rejectedExitConfirmed }));
  verified = true;
} finally {
  if (verified) await rm(directory, { recursive: true, force: true });
  else { await Promise.allSettled(clients.map(client => client.close())); console.error('Schema race observation preserved: acceptance or cleanup not confirmed'); }
}
