// Trusted filesystem cleanup only; no page code or workflow arguments.
import { rm } from 'node:fs/promises';
process.once('disconnect', () => process.exit(1));
process.once('message', async ({ directory }) => {
  let ok = false;
  try {
    // Windows can retain file handles briefly after the browser root exits.
    await rm(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
    ok = true;
  } catch {}
  if (process.connected) process.send({ ok }, () => process.exit(ok ? 0 : 1));
  else process.exit(1);
});
