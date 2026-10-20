// Trusted I/O fault injection, selected only by the source-level test hook.
import fs from 'node:fs/promises';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
const writeFile = fs.writeFile;
fs.writeFile = async (file, data, options) => {
  if (/^\.?run-[0-9a-f-]+\.(json|tmp)$/.test(path.basename(String(file)))) {
    await writeFile(file, '{"partial":', options);
    throw Object.assign(new Error('fake-report-secret-never-expose'), { code: 'ENOSPC' });
  }
  return writeFile(file, data, options);
};
syncBuiltinESMExports();
await import('../execution-worker.mjs');
