// Adversarial detached-child model before ownership receipt, then owner crash.
// Windows non-detached Node children die with their owner via libuv job control;
// detached:true deliberately models a surviving unknown child on every platform.
import { fork } from 'node:child_process';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
process.once('message', async packet => {
  if (packet.type !== 'start') return;
  const control = process.env.PLAYWRIGHT_TEST_UNREPORTED_CONTROL;
  await mkdir(path.dirname(packet.workspaceRoot), { recursive: true, mode: 0o700 });
  await mkdir(packet.workspaceRoot, { mode: 0o700 });
  process.send({ type: 'workspaceCreated' });
  await mkdir(packet.temporaryRoot ?? path.join(packet.workspaceRoot, 'tmp'), { mode: 0o700 });
  await new Promise(resolve => {
    process.on('message', message => { if (message.type === 'temporaryReady') resolve(); });
    process.send({ type: 'temporaryCreated' });
  });
  process.send({ type: 'browserLaunchStarted' });
  const child = fork(fileURLToPath(new URL('./unreported-child.mjs', import.meta.url)), [control], {
    detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true,
  });
  child.on('error', () => process.exit(43));
  // Deliberately no ownedProcess or result message to the supervisor.
  await writeFile(path.join(control, 'worker-ready'), String(process.pid), { flag: 'wx', mode: 0o600 });
  let busy = false;
  setInterval(async () => {
    if (busy) return; busy = true;
    try {
      await access(path.join(control, 'crash-worker'));
      let report = false;
      try { await access(path.join(control, 'report-failure')); report = true; } catch {}
      if (report) process.send({ type: 'result', summary: { ok: false, reason: 'execution_failed', stage: 'execution', completed: 0, total: 1, recentSteps: [], failedStep: null, reportPath: null } }, () => process.exit(0));
      else process.exit(42);
    } catch {} finally { busy = false; }
  }, 20);
});
