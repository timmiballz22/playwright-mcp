// Controlled real SQLite write reproducing the old redundant header assignment.
import { DatabaseSync } from 'node:sqlite';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { JobJournal } from '/workspace/playwright-mcp/local-batch/jobs/journal.mjs';
const open = JobJournal.open;
const close = JobJournal.prototype.close;
let opens = 0;
JobJournal.open = async function(options) {
  const journal = await open.call(this, options);
  if (++opens === 2) {
    const file = path.join(options.directory, 'jobs.sqlite');
    const before = (await stat(file + '-wal')).size;
    const db = new DatabaseSync(file, { allowExtension: false });
    try { db.exec('PRAGMA user_version=1'); } finally { db.close(); }
    const after = (await stat(file + '-wal')).size;
    console.log(JSON.stringify({ fixture: 'controlled_warm_header_write', addedWalBytes: after - before }));
  }
  return journal;
};
JobJournal.prototype.close = async function() {
  await close.call(this);
  if (this.exitConfirmed !== true) throw new Error('controlled_warm_write_exit_unconfirmed');
  console.log(JSON.stringify({ fixture: 'controlled_warm_write_close', actualJournalExitConfirmed: true }));
};
