import { validateRetainedArtifactLimit } from './retained-artifact-budget.mjs';
// Safe stdio/CLI execution boundary. Custom workers/events are trusted source-API
// hooks for fault injection, never accepted in workflow JSON or MCP arguments.
import { validatePageLimit } from './page-budget.mjs';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWorkflow } from './runner.mjs';
import { validateExecutionPolicy } from './policy.mjs';
import { navigationRetryPolicy } from './navigation-retry.mjs';
import { terminateOwnedProcesses } from './process-tree.mjs';

export async function executeWorkflow(input, {
  allowedOrigins = [], artifactsDir = path.resolve('.local-batch-output'), temporaryBase, allowSensitiveArtifacts = false, readOnly = false, maxScreenshotBytes, maxRetainedArtifactBytes, maxPages, navigationRetry, signal,
  workerModule = new URL('./execution-worker.mjs', import.meta.url), onEvent, beforeWorkerStart,
} = {}) {
  if (temporaryBase !== undefined && (typeof temporaryBase !== 'string' || !path.isAbsolute(temporaryBase) || temporaryBase.includes('\0'))) throw new TypeError('Temporary base must be an absolute trusted directory');
  if (maxRetainedArtifactBytes !== undefined) validateRetainedArtifactLimit(maxRetainedArtifactBytes);
  const started = process.hrtime.bigint();
  const encoded = JSON.stringify(input);
  if (typeof encoded !== 'string' || Buffer.byteLength(encoded) > 1048576)
    throw new TypeError('Workflow must be JSON of at most 1 MiB');
  const workflow = JSON.parse(encoded);
  const spec = validateWorkflow(workflow);
  validateExecutionPolicy(spec, { allowedOrigins, allowSensitiveArtifacts, readOnly, maxScreenshotBytes });
  const retryPolicy = navigationRetryPolicy(navigationRetry);
  const pageLimit = validatePageLimit(maxPages);
  const total = spec.steps.length * spec.iterations;
  const runId = randomUUID();
  const elapsed = () => Math.round(Number(process.hrtime.bigint() - started) / 1000000);
  const failure = reason => ({ schemaVersion: 1, runId, ok: false, reason, browser: spec.browser,
    completed: 0, total, durationMs: elapsed(), recentSteps: [], failedStep: null, reportPath: null });
  if (signal?.aborted) return { ...failure('cancelled'), completionCertainty: 'exact', retrySafe: false };
  if (elapsed() >= spec.timeoutMs) return { ...failure('timeout'), completionCertainty: 'exact', retrySafe: false };
  const workerURL = new URL(workerModule);
  if (workerURL.protocol !== 'file:') throw new TypeError('Worker must be a trusted local module');
  const deadlineNs = started + BigInt(spec.timeoutMs) * 1000000n;
  return await new Promise(resolve => {
    let candidate;
    let settled = false;
    let fallbackTimer;
    let forcing = false;
    let stopReason;
    let lastCompleted = 0;
    let workerPid;
    let startAcknowledged = false;
    let failedStep = null;
    const ownedPids = new Set();
    const supervisor = fork(fileURLToPath(new URL('./execution-supervisor.mjs', import.meta.url)), [], {
      // Windows libuv kills non-detached children when the frontend exits.
      // The watchdog must survive that exit to cancel workers and remove temp files.
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'], detached: true, execArgv: [], windowsHide: true,
    });
    const notify = event => { try { onEvent?.(event); } catch {} };
    notify({ type: 'supervisorSpawned', pid: supervisor.pid });
    const finish = summary => {
      if (settled) return;
      // Cancellation can arrive after the watchdog has finished cleanup and sent
      // its result, but before its exit allows this promise to resolve.
      if (summary.ok && stopReason) summary = { ...summary, ok: false, reason: stopReason };
      settled = true;
      clearTimeout(deadlineTimer); clearTimeout(fallbackTimer);
      if (summary.execution?.cleanup === 'failed') {
        if (supervisor.connected) supervisor.disconnect();
        supervisor.unref();
      }
      signal?.removeEventListener('abort', abort);
      resolve({ schemaVersion: 1, runId, browser: spec.browser, total, ...summary,
        completionCertainty: summary.ok || beforeWorkerStart && !startAcknowledged ? 'exact' : 'confirmed_lower_bound',
        ...(!summary.ok ? { retrySafe: false } : {}), durationMs: elapsed() });
    };
    const force = async reason => {
      if (settled || forcing) return;
      forcing = true;
      const cleaned = await terminateOwnedProcesses(supervisor.pid, [...ownedPids], supervisor.exitCode === null && supervisor.signalCode === null);
      finish({ ...failure(cleaned ? reason : 'cleanup_failed'), completed: lastCompleted, failedStep,
        execution: { mode: 'supervised', forced: true, cleanup: cleaned ? 'terminated' : 'failed', tempCleanup: 'unknown', supervisorPid: supervisor.pid, workerPid, browserPids: [...ownedPids].filter(pid => pid !== workerPid) } });
    };
    const stop = reason => {
      stopReason ||= reason;
      if (supervisor.connected) { try { supervisor.send({ type: 'stop', reason: stopReason }, () => {}); } catch {} }
      if (!fallbackTimer) fallbackTimer = setTimeout(() => { void force(stopReason); }, 5000);
    };
    const abort = () => stop('cancelled');
    signal?.addEventListener('abort', abort, { once: true });
    const deadlineTimer = setTimeout(() => { void force(stopReason || 'timeout'); }, Math.max(0, spec.timeoutMs - elapsed()));
    supervisor.on('message', event => {
      if (event.type === 'result') {
        candidate = event.summary;
        notify({ type: 'resultReceived' });
      } else {
        if (event.type === 'workerSpawned') {
          workerPid = event.pid;
          if (beforeWorkerStart) {
            Promise.resolve().then(() => {
              if (!settled && !forcing && !stopReason) return beforeWorkerStart({ pid: event.pid });
            }).then(() => {
              if (!settled && !forcing && !stopReason && supervisor.connected) {
                startAcknowledged = true;
                supervisor.send({ type: 'workerReady' }, () => {});
              }
            }).catch(() => { if (!settled && !forcing) stop('journal_unavailable'); });
          }
        }
        if (event.pid) ownedPids.add(event.pid);
        if (event.type === 'progress') lastCompleted = event.completed;
        if (event.type === 'actionFailure') {
          failedStep = event.failedStep;
          if (Number.isInteger(event.completed) && event.completed >= lastCompleted && event.completed <= total)
            lastCompleted = event.completed;
        }
        notify(event);
      }
    });
    supervisor.once('error', () => finish(failure('supervisor_failed')));
    supervisor.once('exit', async code => {
      if (forcing) return;
      if (!candidate || code !== 0) {
        const cleaned = await terminateOwnedProcesses(workerPid || supervisor.pid, [...ownedPids].filter(pid => pid !== workerPid), Boolean(workerPid));
        finish({ ...failure(cleaned ? (stopReason || 'supervisor_failed') : 'cleanup_failed'), completed: lastCompleted, failedStep,
          execution: { mode: 'supervised', forced: Boolean(workerPid), cleanup: cleaned ? 'terminated' : 'failed', tempCleanup: workerPid ? 'unknown' : 'not-created', supervisorPid: supervisor.pid, workerPid, browserPids: [...ownedPids].filter(pid => pid !== workerPid) } });
        return;
      }
      const summary = candidate;
      finish(summary.ok && elapsed() > spec.timeoutMs ? { ...summary, ok: false, reason: 'timeout' } : summary);
    });
    if (signal?.aborted) abort();
    else if (elapsed() >= spec.timeoutMs) void force('timeout');
    else supervisor.send({ type: 'start', workflow, options: { allowedOrigins, artifactsDir, temporaryBase, allowSensitiveArtifacts, readOnly, maxScreenshotBytes, maxRetainedArtifactBytes, maxPages: pageLimit, navigationRetry: retryPolicy ?? undefined },
      workerModule: workerURL.href, requireReadyAck: Boolean(beforeWorkerStart), runId, total, timeoutMs: spec.timeoutMs, deadlineNs: String(deadlineNs) }, () => {});
  });
}
