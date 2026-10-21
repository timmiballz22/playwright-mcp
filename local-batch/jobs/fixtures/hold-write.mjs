// Trusted contention fixture, never selected by workflow JSON.
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(process.argv[2]);
db.exec('BEGIN IMMEDIATE');
let stopped = false;
function release() {
  if (stopped) return; stopped = true; clearTimeout(timer);
  db.exec('ROLLBACK'); db.close();
  if (process.connected) process.disconnect();
}
const timer = setTimeout(release, 5000);
process.once('disconnect', release);
process.once('message', release);
process.send({ locked: true });
