// Independent watchdog: it never imports Playwright or executes page/workflow code.
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { terminateOwnedProcesses } from './process-tree.mjs';
let worker;
let packet;
let deadlineTimer;
let forceTimer;
let stopReason;
let candidate;
let finishing = false;
let workerExited = false;
let forced = false;
let completed = 0;
let workspaceRoot;
let ownsWorkspace = false;
const browserPids = new Set();
const send = value => {
  if (process.connected) { try { process.send(value, () => {}); } catch {} }
};
const remaining = () => Number((BigInt(packet.deadlineNs) - process.hrtime.bigint()) / 1000000n);

async function finish(exitCode) {
  if (finishing) return;
  finishing = true;
  clearTimeout(deadlineTimer); clearTimeout(forceTimer);
  let cleaned = await terminateOwnedProcesses(worker.pid, [...browserPids], !workerExited);
  let tempCleanup = 'not-created';
  if (ownsWorkspace) {
    try { await rm(path.join(workspaceRoot, 'tmp'), { recursive: true, force: true, maxRetries: 2, retryDelay: 10 }); tempCleanup = 'removed'; }
    catch { cleaned = false; tempCleanup = 'failed'; }
  }
  const reason = !cleaned ? 'cleanup_failed' : stopReason ||
    (remaining() <= 0 ? 'timeout' : exitCode !== 0 ? 'worker_crashed' : candidate ? null : 'execution_failed');
  const summary = reason ? { ok: false, reason, completed, total: packet.total,
    recentSteps: [], failedStep: null, reportPath: null } : candidate;
  const response = { type: 'result', summary: { ...summary, execution: { mode: 'supervised', forced, cleanup: cleaned ? 'terminated' : 'failed', tempCleanup, supervisorPid: process.pid, workerPid: worker.pid, browserPids: [...browserPids] } } };
  if (process.connected) {
    process.send(response, () => { if (process.connected) process.disconnect(); });
  }
}
async function force() {
  if (finishing) return;
  forced = true;
  await finish(null);
}
function stop(reason) {
  if (finishing || stopReason) return;
  stopReason = reason;
  if (!worker) { if (process.connected) process.disconnect(); return; }
  if (worker.connected) { try { worker.send({ type: 'abort' }, () => {}); } catch {} }
  forceTimer = setTimeout(() => { void force(); }, Math.max(0, Math.min(200, remaining())));
}
process.once('disconnect', () => stop('cancelled'));
process.on('message', message => {
  if (message.type === 'stop') { stop(message.reason === 'timeout' ? 'timeout' : 'cancelled'); return; }
  if (message.type !== 'start' || packet || !process.connected || stopReason) return;
  packet = message;
  workspaceRoot = path.resolve(packet.options.artifactsDir, 'exec-' + packet.runId);
  worker = fork(fileURLToPath(new URL(packet.workerModule)), [], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'], detached: process.platform !== 'win32',
    execArgv: ['--max-old-space-size=256'], windowsHide: true,
  });
  send({ type: 'workerSpawned', pid: worker.pid });
  worker.on('message', event => {
    if (event.type === 'workspaceCreated') {
      ownsWorkspace = true;
    } else if (event.type === 'ownedProcess' && Number.isSafeInteger(event.pid) && event.pid > 1 && event.pid !== process.pid && event.pid !== process.ppid) {
      browserPids.add(event.pid); send(event);
    } else if (event.type === 'progress' && Number.isInteger(event.completed) && event.completed >= completed && event.completed <= packet.total) {
      completed = event.completed;
      if (completed % 25 === 0 || completed === packet.total) send({ type: 'progress', completed });
    } else if (event.type === 'result' && event.summary && typeof event.summary.ok === 'boolean') {
      candidate = event.summary;
      completed = Math.max(completed, candidate.completed || 0);
    }
  });
  worker.once('error', () => { stopReason = 'worker_crashed'; void force(); });
  worker.once('exit', code => { workerExited = true; void finish(code); });
  // Reserve part of the same deadline for cancellation, process termination and
  // reporting. A stalled report or even a stalled event loop cannot evade this.
  const reserve = Math.min(1000, Math.max(20, packet.timeoutMs / 5));
  deadlineTimer = setTimeout(() => stop('timeout'), Math.max(0, remaining() - reserve));
  worker.send({ type: 'start', workflow: packet.workflow, options: packet.options, runId: packet.runId, workspaceRoot }, () => {});
  if (stopReason) { const reason = stopReason; stopReason = undefined; stop(reason); }
});
