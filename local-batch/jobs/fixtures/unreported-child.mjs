// Checkout-only orphan model. Its private control file requests self-exit;
// the test never signals a PID read from a file or process table.
import { writeFile, access } from 'node:fs/promises';
import path from 'node:path';
const directory = process.argv[2];
await writeFile(path.join(directory, 'child-ready'), String(process.pid), { flag: 'wx', mode: 0o600 });
setTimeout(() => process.exit(1), 20000);
let busy = false;
setInterval(async () => {
  if (busy) return; busy = true;
  try { await access(path.join(directory, 'stop-child')); process.exit(0); } catch {} finally { busy = false; }
}, 20);
