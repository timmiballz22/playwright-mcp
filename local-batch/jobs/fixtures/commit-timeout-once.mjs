// Trusted real-SQLite calibration: withhold COMMIT completion once or persistently.
import { DatabaseSync } from 'node:sqlite';
import { appendFileSync, openSync, closeSync } from 'node:fs';
import path from 'node:path';
import '../journal-worker.mjs';
let directory, initialCommit = true;
process.prependListener('message', packet => { if (packet.command === 'init') directory = packet.data.directory; });
const exec = DatabaseSync.prototype.exec;
DatabaseSync.prototype.exec = function(sql, ...args) {
  if (sql !== 'COMMIT' || !initialCommit) return Reflect.apply(exec, this, [sql, ...args]);
  initialCommit = false;
  const phase = process.env.PLAYWRIGHT_TEST_COMMIT_TIMEOUT_PHASE;
  if (!['before', 'after', 'persistent'].includes(phase)) throw new Error('invalid_commit_timeout_calibration');
  let pause = phase === 'persistent';
  if (!pause) {
    try { closeSync(openSync(path.join(directory, 'commit-pause-once'), 'wx', 0o600)); pause = true; }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  appendFileSync(path.join(directory, 'commit-attempts.jsonl'), JSON.stringify({ phase, pause }) + '\n', { mode: 0o600 });
  if (pause && phase !== 'after') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  const result = Reflect.apply(exec, this, [sql, ...args]);
  if (pause) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  return result;
};
