// Trusted collision fixture: the worker must not claim or delete this directory.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import '../execution-worker.mjs';
process.prependOnceListener('message', packet => {
  mkdirSync(packet.temporaryRoot, { mode: 0o700 });
  writeFileSync(path.join(packet.temporaryRoot, 'existing-marker'), 'preserve-owned-fixture', { flag: 'wx', mode: 0o600 });
});
