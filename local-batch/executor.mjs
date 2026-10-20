// Safe stdio/CLI execution boundary. Custom workers/events are trusted source-API
// hooks for fault injection, never accepted in workflow JSON or MCP arguments.
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWorkflow } from './runner.mjs';
import { terminateOwnedProcesses } from './process-tree.mjs';

export async function executeWorkflow(input, {
  allowedOrigins = [], artifactsDir = path.resolve('.local-batch-output'), allowSensitiveArtifacts = false, signal,
  workerModule = new URL('./execution-worker.mjs', import.meta.url), onEvent,
} = {}) {
  const started = process.hrtime.bigint();
  const encoded = JSON.stringify(input);
  if (typeof encoded !== 'string' || Buffer.byteLength(encoded) > 1048576)
    throw new TypeError('Workflow must be JSON of at most 1 MiB');
  const workflow = JSON.parse(encoded);
  const spec = validateWorkflow(workflow);
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
    const ownedPids = new Set();
    const supervisor = fork(fileURLToPath(new URL('./execution-supervisor.mjs', import.meta.url)), [], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'], detached: process.platform !== 'win32', execArgv: [], windowsHide: true,
    });
    const notify = event => { try { onEvent?.(event); } catch {} };
    notify({ type: 'supervisorSpawned', pid: supervisor.pid });
    const finish = summary => {
      if (settled) return;
      settled = true;
      clearTimeout(deadlineTimer); clearTimeout(fallbackTimer);
      if (summary.execution?.cleanup === 'failed') {
        if (supervisor.connected) supervisor.disconnect();
        supervisor.unref();
      }
      signal?.removeEventListener('abort', abort);
      resolve({ schemaVersion: 1, runId, browser: spec.browser, total, ...summary,
        completionCertainty: summary.ok ? 'exact' : 'confirmed_lower_bound',
        ...(!summary.ok ? { retrySafe: false } : {}), durationMs: elapsed() });
    };
    const force = async reason => {
      if (settled || forcing) return;
      forcing = true;
      const cleaned = await terminateOwnedProcesses(supervisor.pid, [...ownedPids], supervisor.exitCode === null && supervisor.signalCode === null);
      finish({ ...failure(cleaned ? reason : 'cleanup_failed'), completed: lastCompleted,
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
      if (event.type === 'result') candidate = event.summary;
      else {
        if (event.type === 'workerSpawned') workerPid = event.pid;
        if (event.pid) ownedPids.add(event.pid);
        if (event.type === 'progress') lastCompleted = event.completed;
        notify(event);
      }
    });
    supervisor.once('error', () => finish(failure('supervisor_failed')));
    supervisor.once('exit', async code => {
      if (forcing) return;
      if (!candidate || code !== 0) {
        const cleaned = await terminateOwnedProcesses(workerPid || supervisor.pid, [...ownedPids].filter(pid => pid !== workerPid), Boolean(workerPid));
        finish({ ...failure(cleaned ? (stopReason || 'supervisor_failed') : 'cleanup_failed'), completed: lastCompleted,
          execution: { mode: 'supervised', forced: Boolean(workerPid), cleanup: cleaned ? 'terminated' : 'failed', tempCleanup: workerPid ? 'unknown' : 'not-created', supervisorPid: supervisor.pid, workerPid, browserPids: [...ownedPids].filter(pid => pid !== workerPid) } });
        return;
      }
      const summary = candidate;
      finish(summary.ok && elapsed() > spec.timeoutMs ? { ...summary, ok: false, reason: 'timeout' } : summary);
    });
    if (signal?.aborted) abort();
    else if (elapsed() >= spec.timeoutMs) void force('timeout');
    else supervisor.send({ type: 'start', workflow, options: { allowedOrigins, artifactsDir, allowSensitiveArtifacts },
      workerModule: workerURL.href, runId, total, timeoutMs: spec.timeoutMs, deadlineNs: String(deadlineNs) }, () => {});
  });
}
