// Trusted fault fixture: completed actions/report do not finish the lifecycle
// until the watchdog starts its cleanup reserve and requests cancellation.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { saveReport } from '../report.mjs';
let summary;
let aborted = false;
function reply() {
  if (summary && aborted) process.send({ type: 'result', summary }, () => process.disconnect());
}
process.on('message', async packet => {
  if (packet.type === 'abort') { aborted = true; reply(); return; }
  if (packet.type !== 'start') return;
  await mkdir(path.join(packet.workspaceRoot, 'tmp'), { recursive: true, mode: 0o700 });
  await new Promise(resolve => process.send({ type: 'workspaceCreated' }, resolve));
  summary = await saveReport({ schemaVersion: 1, runId: packet.runId, reportScope: 'worker_execution',
    ok: true, reason: null, actionsSucceeded: true, completed: 1, total: 1, blockedRequests: 0,
    results: [{ index: 1, type: 'click', ok: true, durationMs: 1 }] }, packet.workspaceRoot);
  reply();
});
