// Checkout-only observation gate around the actual public BrowserServer factory.
import { access, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
let stopped = false;
process.on('message', message => { if (message.type === 'abort') stopped = true; });
process.once('disconnect', () => { stopped = true; });
process.once('message', async packet => {
  if (packet.type !== 'start') return;
  const temporary = packet.temporaryRoot ?? path.join(packet.workspaceRoot, 'tmp');
  process.env.TMPDIR = temporary; process.env.TEMP = temporary; process.env.TMP = temporary;
  const control = process.env.PLAYWRIGHT_TEST_LIFETIME_CONTROL;
  const playwright = await import('playwright');
  const type = playwright[packet.workflow.browser ?? 'chromium'];
  const launch = type.launchServer.bind(type);
  type.launchServer = async (...args) => {
    const server = await launch(...args); const child = server.process();
    const live = () => !stopped && process.connected && child.exitCode === null && child.signalCode === null;
    try {
      if (!live()) throw new Error('factory_not_live_before_observation');
      const file = path.join(control, packet.runId + '.ready.json');
      await writeFile(file + '.tmp', JSON.stringify({ runId: packet.runId, workerPid: process.pid, browserPid: child.pid }), { flag: 'wx', mode: 0o600 });
      await rename(file + '.tmp', file);
      for (;;) {
        if (!live()) throw new Error('factory_not_live_during_observation');
        try { await access(path.join(control, packet.runId + '.release')); break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      if (!live()) throw new Error('factory_not_live_after_observation');
      return server;
    } catch (error) {
      // Kill authority comes only from this actual public BrowserServer handle.
      void server.kill().catch(() => {});
      throw error;
    }
  };
  await import('../../execution-worker.mjs');
  process.emit('message', packet);
});
