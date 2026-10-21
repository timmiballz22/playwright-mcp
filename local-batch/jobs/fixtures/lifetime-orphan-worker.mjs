// Checkout-only factory fault model. Actual detached child, no real browser.
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rename, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
process.once('message', async packet => {
  if (packet.type !== 'start') return;
  await mkdir(path.dirname(packet.workspaceRoot), { recursive: true, mode: 0o700 });
  await mkdir(packet.workspaceRoot, { mode: 0o700 }); process.send({ type: 'workspaceCreated' });
  await mkdir(packet.temporaryRoot ?? path.join(packet.workspaceRoot, 'tmp'), { mode: 0o700 });
  await new Promise(resolve => {
    process.on('message', message => { if (message.type === 'temporaryReady') resolve(); });
    process.send({ type: 'temporaryCreated' });
  });
  const control = process.env.PLAYWRIGHT_TEST_LIFETIME_CONTROL;
  const childControl = path.join(control, packet.runId); await mkdir(childControl, { mode: 0o700 });
  process.send({ type: 'browserLaunchStarted' });
  const child = spawn(process.execPath, [fileURLToPath(new URL('./unreported-child.mjs', import.meta.url)), childControl], {
    detached: true, stdio: 'ignore', windowsHide: true,
  });
  child.on('error', () => process.exit(43));
  child.on('exit', () => { void writeFile(path.join(control, packet.runId + '.child-exited'), 'exited', { flag: 'wx', mode: 0o600 }).catch(() => process.exit(43)); });
  child.unref();
  if (process.env.PLAYWRIGHT_TEST_LIFETIME_COLLISION === '1')
    await writeFile(path.join(control, packet.runId + '.identities.json'), 'preserve-factory-collision', { flag: 'wx', mode: 0o600 });
  const file = path.join(control, packet.runId + '.ready.json');
  await writeFile(file + '.tmp', JSON.stringify({ runId: packet.runId, workerPid: process.pid, browserPid: child.pid }), { flag: 'wx', mode: 0o600 });
  await rename(file + '.tmp', file);
  let busy = false;
  setInterval(async () => {
    if (busy) return; busy = true;
    try {
      await access(path.join(control, packet.runId + '.release'));
      if (process.env.PLAYWRIGHT_TEST_LIFETIME_COLLISION !== '1') {
        if (child.exitCode !== null || child.signalCode !== null) process.exit(45);
        await writeFile(path.join(control, packet.runId + '.released-alive'), 'alive', { flag: 'wx', mode: 0o600 });
      }
      process.exit(42);
    } catch {} finally { busy = false; }
  }, 20);
});
