import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { saveReport } from '../report.mjs';
import path from 'node:path';
export function cleanupResult({ blocked = false, actionFailed = false } = {}) {
  process.once('message', async packet => {
    if (packet.type !== 'start') return;
    await mkdir(path.dirname(packet.workspaceRoot), { recursive: true, mode: 0o700 });
    await mkdir(packet.workspaceRoot, { mode: 0o700 });
    await mkdir(path.join(packet.workspaceRoot, 'tmp'), { mode: 0o700 });
    await new Promise(resolve => process.send({ type: 'workspaceCreated' }, resolve));
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      detached: process.platform !== 'win32', stdio: 'ignore', windowsHide: true,
    });
    child.once('spawn', () => process.send({ type: 'ownedProcess', pid: child.pid }, async () => {
      const step = { index: 1, type: 'click', ok: !actionFailed, durationMs: 1, ...(actionFailed ? { error: 'action_failed', failureKind: 'unknown' } : {}) };
      const summary = await saveReport({ schemaVersion: 1, runId: packet.runId, reportScope: 'worker_execution',
        ok: false, reason: 'cleanup_failed', actionsSucceeded: !actionFailed,
        completed: actionFailed ? 0 : 1, total: 1, blockedRequests: blocked ? 1 : 0,
        results: [step] }, packet.workspaceRoot);
      process.send({ type: 'result', summary }, () => {
        child.unref(); process.disconnect();
      });
    }));
  });
}
