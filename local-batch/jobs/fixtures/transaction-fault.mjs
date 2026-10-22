// Trusted test instrumentation: stop after inserts, before transaction commit.
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import '../journal-worker.mjs';
let directory;
let armed = false;
process.prependListener('message', packet => {
  if (packet.command === 'init') directory = packet.data.directory;
  if (packet.command === 'create') armed = true;
});
const original = DatabaseSync.prototype.exec;
DatabaseSync.prototype.exec = function(sql) {
  if (process.env.PLAYWRIGHT_TEST_JOURNAL_INIT_PAUSE === '1' && sql === 'PRAGMA page_size=4096') {
    writeFileSync(path.join(directory, 'init-configure-paused'), '', { mode: 0o600, flag: 'wx' });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  }
  if (armed && sql === 'COMMIT') {
    writeFileSync(path.join(directory, 'transaction-paused'), '', { mode: 0o600, flag: 'wx' });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  }
  return original.call(this, sql);
};
