// Trusted test instrumentation: stop after inserts, before transaction commit.
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
let directory;
let armed = false;
process.on('message', packet => {
  if (packet.command === 'init') directory = packet.data.directory;
  if (packet.command === 'create') armed = true;
});
const original = DatabaseSync.prototype.exec;
DatabaseSync.prototype.exec = function(sql) {
  if (armed && sql === 'COMMIT') {
    writeFileSync(path.join(directory, 'transaction-paused'), '', { mode: 0o600, flag: 'wx' });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  }
  return original.call(this, sql);
};
await import('../journal-worker.mjs');
