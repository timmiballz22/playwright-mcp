// Trusted I/O fault injection, selected only by the source-level test hook.
import fs from 'node:fs/promises';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
const open = fs.open;
fs.open = async (filename, ...args) => {
  const file = await open(filename, ...args);
  if (/^\.?run-[0-9a-f-]+\.(json|tmp)$/.test(path.basename(String(filename)))) {
    const writeFile = file.writeFile.bind(file);
    file.writeFile = async () => {
      await writeFile('{"partial":');
      throw Object.assign(new Error('fake-report-secret-never-expose'), { code: 'ENOSPC' });
    };
  }
  return file;
};
syncBuiltinESMExports();
await import('../execution-worker.mjs');
