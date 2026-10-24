// Checkout-only public launch fault; use the actual worker/report implementation.
import { spawn } from 'node:child_process';
import { writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
process.once('message', async packet => {
  if (packet.type !== 'start') return;
  const temporary = packet.temporaryRoot ?? path.join(packet.workspaceRoot, 'tmp');
  process.env.TMPDIR = temporary; process.env.TEMP = temporary; process.env.TMP = temporary;
  const playwright = await import('playwright');
  const control = process.env.PLAYWRIGHT_TEST_UNREPORTED_CONTROL;
  playwright[packet.workflow.browser ?? 'chromium'].launchServer = async () => {
    const child = spawn(process.execPath, [fileURLToPath(new URL('./unreported-child.mjs', import.meta.url)), control], {
      detached: true, stdio: 'ignore', windowsHide: true,
    });
    child.on('error', () => process.exit(43));
    child.unref();
    await writeFile(path.join(control, 'worker-ready'), String(process.pid), { flag: 'wx', mode: 0o600 });
    for (;;) {
      try { await access(path.join(control, 'crash-worker')); break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('private-rejected-launch-canary');
  };
  await import('../../execution-worker.mjs');
  process.emit('message', packet);
});
