// Trusted crash after acknowledged temporary ownership, before browser effects.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
process.on('message', packet => {
  if (packet.type === 'temporaryReady') { process.exit(7); return; }
  if (packet.type !== 'start') return;
  mkdirSync(path.dirname(packet.workspaceRoot), { recursive: true, mode: 0o700 });
  mkdirSync(packet.workspaceRoot, { mode: 0o700 });
  process.send({ type: 'workspaceCreated' }, error => {
    if (error) { process.exit(2); return; }
    mkdirSync(packet.temporaryRoot, { mode: 0o700 });
    writeFileSync(path.join(packet.temporaryRoot, 'owned-marker'), 'owned-fault-fixture', { flag: 'wx', mode: 0o600 });
    process.send({ type: 'temporaryCreated' });
  });
});
