// Checkout-only fault: hold a filesystem await in the actual execution worker.
import fs from 'node:fs/promises';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
fs.opendir = async directory => {
  await fs.writeFile(path.join(directory, 'scan-stalled'), 'pending', { flag: 'wx', mode: 0o600 });
  return await new Promise(() => {});
};
syncBuiltinESMExports();
await import('../../execution-worker.mjs');
