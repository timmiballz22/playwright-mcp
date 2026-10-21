// Independent watchdog: it never imports Playwright or executes page/workflow code.
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { lstat } from 'node:fs/promises';
import { cleanupTemporaryDirectory } from './cleanup.mjs';
import { terminateOwnedProcesses } from './process-tree.mjs';
import { FAILURE_KINDS, STEP_FAILURE_CODES } from './failure.mjs';
let worker;
let packet;
let deadlineTimer;
let forceTimer;
let stopReason;
let candidate;
let finishing = false;
let workerExited = false;
let workerStarted = false;
let forced = false;
let completed = 0;
let failedStep = null;
let workspaceRoot;
let ownsWorkspace = false;
let temporaryRoot;
let externalTemporary = false;
let ownsTemporary = false;
const browserPids = new Set();
const send = value => {
  if (process.connected) { try { process.send(value, () => {}); } catch {} }
};
const remaining = () => Number((BigInt(packet.deadlineNs) - process.hrtime.bigint()) / 1000000n);

async function finish(exitCode) {
  if (finishing) return;
  finishing = true;
  clearTimeout(deadlineTimer); clearTimeout(forceTimer);
  const terminationFailures = [];
  let cleaned = await terminateOwnedProcesses(worker.pid, [...browserPids], !workerExited, code => {
    if (terminationFailures.length < 8 && !terminationFailures.includes(code)) terminationFailures.push(code);
  });
  let tempCleanup = 'not-created';
  if (externalTemporary && !ownsTemporary) {
    // A collision or crash before the creation ACK never grants deletion rights.
    // A surviving unacknowledged directory makes cleanup uncertain, not empty.
    try { await lstat(temporaryRoot); tempCleanup = 'unknown'; cleaned = false; }
    catch (error) { if (error.code !== 'ENOENT') { tempCleanup = 'unknown'; cleaned = false; } }
  } else if (ownsWorkspace || ownsTemporary) {
    const removed = await cleanupTemporaryDirectory(temporaryRoot, Math.max(1, Math.min(2000, remaining())), path.join(workspaceRoot, 'cleanup-diagnostic.json'));
    tempCleanup = removed ? 'removed' : 'failed';
    if (!removed) cleaned = false;
  }

  const reason = !cleaned ? 'cleanup_failed' : stopReason ||
    (remaining() <= 0 ? 'timeout' : exitCode !== 0 ? 'worker_crashed' : candidate ? null : 'execution_failed');
  let summary = reason ? { ok: false, reason, completed, total: packet.total,
    recentSteps: [], failedStep, reportPath: null } : candidate;
  const workerCleanupFailed = !reason && candidate?.reason === 'cleanup_failed';
  const workerReportPublished = candidate?.reportScope === 'worker_execution' && typeof candidate.reportPath === 'string' &&
    path.dirname(candidate.reportPath) === workspaceRoot && /^run-[0-9a-f-]+\.json$/.test(path.basename(candidate.reportPath));
  if (workerCleanupFailed && workerReportPublished && tempCleanup === 'removed' &&
      Number.isInteger(candidate.blockedRequests) && candidate.blockedRequests >= 0 && typeof candidate.actionsSucceeded === 'boolean') {
    // The worker's cooperative close failure is superseded only after this
    // independent watchdog has verified termination and temporary cleanup within
    // the same deadline. Action and policy failures remain failures.
    const actionsConfirmed = candidate.actionsSucceeded === true && candidate.completed === packet.total && candidate.failedStep === null;
    summary = { ...candidate, ok: actionsConfirmed && candidate.blockedRequests === 0,
      reason: candidate.blockedRequests ? 'policy_blocked' : actionsConfirmed ? null : 'action_failed' };
  }
  const response = { type: 'result', summary: { ...summary, execution: { mode: 'supervised', forced, cleanup: cleaned ? 'terminated' : 'failed', tempCleanup, supervisorPid: process.pid, workerPid: worker.pid, browserPids: [...browserPids], ...(workerCleanupFailed ? { workerCleanupFailed: true } : {}), ...(terminationFailures.length ? { terminationFailures } : {}) } } };
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
  forceTimer = setTimeout(() => { void force(); }, Math.max(0, Math.min(process.platform === 'win32' ? 750 : 200, remaining() / 3)));
}
process.once('disconnect', () => stop('cancelled'));
function startWorker() {
  if (!worker || workerStarted || finishing || stopReason || remaining() <= 0 || !worker.connected) return;
  workerStarted = true;
  worker.send({ type: 'start', workflow: packet.workflow, options: packet.options, runId: packet.runId, workspaceRoot, temporaryRoot }, () => {});
}
process.on('message', message => {
  if (message.type === 'workerReady') { if (packet?.requireReadyAck) startWorker(); return; }
  if (message.type === 'stop') { stop(['timeout', 'journal_unavailable'].includes(message.reason) ? message.reason : 'cancelled'); return; }
  if (message.type !== 'start' || packet || !process.connected || stopReason) return;
  packet = message;
  workspaceRoot = path.resolve(packet.options.artifactsDir, 'exec-' + packet.runId);
  externalTemporary = packet.options.temporaryBase !== undefined;
  temporaryRoot = externalTemporary ? path.resolve(packet.options.temporaryBase, 'tmp-' + packet.runId) : path.join(workspaceRoot, 'tmp');
  worker = fork(fileURLToPath(new URL(packet.workerModule)), [], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'], detached: process.platform !== 'win32',
    execArgv: ['--max-old-space-size=256'], windowsHide: true,
  });
  send({ type: 'workerSpawned', pid: worker.pid });
  worker.on('message', event => {
    if (event.type === 'workspaceCreated') {
      ownsWorkspace = true;
    } else if (event.type === 'temporaryCreated' && ownsWorkspace) {
      ownsTemporary = true;
      if (worker.connected) worker.send({ type: 'temporaryReady' }, () => {});
    } else if (event.type === 'ownedProcess' && Number.isSafeInteger(event.pid) && event.pid > 1 && event.pid !== process.pid && event.pid !== process.ppid) {
      browserPids.add(event.pid); send(event);
    } else if (event.type === 'progress' && Number.isInteger(event.completed) && event.completed >= completed && event.completed <= packet.total) {
      completed = event.completed;
      if (completed === 1 || completed % 25 === 0 || completed === packet.total) send({ type: 'progress', completed });
    } else if (event.type === 'actionFailure' && Number.isInteger(event.failedStep?.index) && event.failedStep.index > 0 &&
        event.failedStep.index <= packet.total && ['goto', 'click', 'fill', 'press', 'check', 'uncheck', 'hover', 'waitFor', 'assertText', 'assertURL', 'scroll', 'screenshot'].includes(event.failedStep.type) &&
        FAILURE_KINDS.includes(event.failedStep.failureKind) && STEP_FAILURE_CODES.includes(event.failedStep.error)) {
      failedStep = { index: event.failedStep.index, type: event.failedStep.type, ok: false,
        error: event.failedStep.error, failureKind: event.failedStep.failureKind };
      send({ type: 'actionFailure', failedStep, completed });
    } else if (event.type === 'result' && event.summary && typeof event.summary.ok === 'boolean') {
      candidate = event.summary;
      completed = Math.max(completed, candidate.completed || 0);
    }
  });
  worker.once('error', () => { stopReason = 'worker_crashed'; void force(); });
  worker.once('exit', code => { workerExited = true; void finish(code); });
  // Reserve part of the same deadline for cancellation, process termination and
  // reporting. A stalled report or even a stalled event loop cannot evade this.
  const reserve = process.platform === 'win32' ? Math.min(3000, Math.max(20, packet.timeoutMs / 2)) : Math.min(1000, Math.max(20, packet.timeoutMs / 5));
  deadlineTimer = setTimeout(() => stop('timeout'), Math.max(0, remaining() - reserve));
  if (!packet.requireReadyAck) startWorker();
  if (stopReason) { const reason = stopReason; stopReason = undefined; stop(reason); }
});
