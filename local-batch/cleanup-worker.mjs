// Trusted filesystem cleanup only; no page code or workflow arguments.
import { rm, writeFile, rename } from 'node:fs/promises';
process.once('disconnect', () => process.exit(1));
process.once('message', async ({ directory, diagnosticPath }) => {
  let ok = false;
  let code = null;
  try {
    // Windows can retain file handles briefly after the browser root exits.
    await rm(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
    ok = true;
  } catch (error) { code = ['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY', 'ENOENT'].includes(error.code) ? error.code : 'filesystem_error'; }
  if (diagnosticPath) {
    try {
      await writeFile(diagnosticPath + '.tmp', JSON.stringify({ schemaVersion: 1, ok, code }), { mode: 0o600, flag: 'wx' });
      await rename(diagnosticPath + '.tmp', diagnosticPath);
    } catch {}
  }
  if (process.connected) process.send({ ok }, () => process.exit(ok ? 0 : 1));
  else process.exit(1);
});
