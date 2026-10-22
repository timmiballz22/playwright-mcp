// Trusted QA: a separate SQLite connection changes the version after identity
// validation, before the real worker acquires its schema write transaction.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import '../journal-worker.mjs';
let directory, changed = false;
process.prependListener('message', packet => {
  if (packet.command === 'init') directory = packet.data.directory;
});
const exec = DatabaseSync.prototype.exec;
DatabaseSync.prototype.exec = function(sql) {
  if (!changed && sql === 'PRAGMA page_size=4096') {
    changed = true;
    const other = new DatabaseSync(path.join(directory, 'jobs.sqlite'), { allowExtension: false });
    try {
      const mode = process.env.PLAYWRIGHT_TEST_JOURNAL_SCHEMA_RACE || 'future_version';
      if (mode === 'future_version') exec.call(other, 'PRAGMA user_version=2');
      else if (mode === 'cleared_version') exec.call(other, 'PRAGMA user_version=0');
      else if (mode === 'deleted_identity') exec.call(other, "DELETE FROM meta WHERE key='project'");
      else throw new Error('invalid_schema_race_fixture_mode');
    } finally { other.close(); }
  }
  return exec.call(this, sql);
};
