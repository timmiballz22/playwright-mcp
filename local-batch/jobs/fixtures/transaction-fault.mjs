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
const pauses = new Map([
  ['1', ['configure', 'exec', sql => sql === 'PRAGMA page_size=4096']],
  ['schema', ['schema', 'exec', sql => sql === 'BEGIN IMMEDIATE']],
  ['schema_tables', ['schema_tables', 'exec', sql => sql.startsWith('CREATE TABLE IF NOT EXISTS meta ')]],
  ['schema_metadata', ['schema_metadata', 'prepare', sql => sql === 'INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)']],
  ['schema_verify', ['schema_verify', 'prepare', sql => sql === 'SELECT value FROM meta WHERE key=?']],
  ['schema_commit', ['schema_commit', 'exec', sql => sql === 'COMMIT']],
]);
function pause(method, sql) {
  const entry = pauses.get(process.env.PLAYWRIGHT_TEST_JOURNAL_INIT_PAUSE);
  if (!armed && entry && entry[1] === method && entry[2](sql)) {
    try { writeFileSync(path.join(directory, 'init-' + entry[0] + '-paused'), '', { mode: 0o600, flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; } // Retain the first marker across bounded init retries.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  }
}
const prepare = DatabaseSync.prototype.prepare;
DatabaseSync.prototype.prepare = function(sql) { pause('prepare', sql); return prepare.call(this, sql); };
const original = DatabaseSync.prototype.exec;
DatabaseSync.prototype.exec = function(sql) {
  pause('exec', sql);
  if (armed && sql === 'COMMIT') {
    writeFileSync(path.join(directory, 'transaction-paused'), '', { mode: 0o600, flag: 'wx' });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  }
  return original.call(this, sql);
};
