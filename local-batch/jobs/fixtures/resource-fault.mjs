// Trusted test module: a fixed resource-ownership statement fails before commit.
import { DatabaseSync } from 'node:sqlite';
const prepare = DatabaseSync.prototype.prepare;
DatabaseSync.prototype.prepare = function(sql) {
  if (sql === 'UPDATE jobs SET worker_pid=? WHERE id=?')
    throw Object.assign(new Error('fixture_storage_full'), { errcode: 13 });
  return prepare.call(this, sql);
};
await import('../journal-worker.mjs');
