// Trusted internal process protocol, never a model-selected module or public tool.
import path from 'node:path';
import { JobJournal } from './journal.mjs';
import { executeWorkflow } from '../executor.mjs';
import { captureWorkflow } from './workflow-snapshot.mjs';
const abort = new AbortController();
let journal;
let packet;
let polling;
let pollBusy = false;
let writes = Promise.resolve();
let journalFailed = false;
let cancelQueued = false;
const send = value => { if (process.connected) { try { process.send(value, () => {}); } catch {} } };
const stop = () => {
  abort.abort();
  if (!packet) { clearTimeout(startupTimer); if (process.connected) process.disconnect(); return; }
  if (journal && packet && !cancelQueued && !journalFailed) {
    cancelQueued = true;
    void write('cancel', { id: packet.id }).catch(() => {});
  }
};
process.once('disconnect', stop);
process.once('SIGTERM', stop);
function write(command, data) {
  const pending = writes.then(() => journal.call(command, data));
  writes = pending.catch(() => { journalFailed = true; stop(); });
  return pending;
}
function safeSummary(summary) {
  const result = { ...summary };
  if (typeof result.reportPath === 'string') {
    const match = path.basename(result.reportPath).match(/^run-([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\.json$/);
    const expected = path.resolve(packet.execution?.artifactsDir ?? '.local-batch-output', 'exec-' + result.runId);
    if (!match || path.dirname(path.resolve(result.reportPath)) !== expected) throw new Error('invalid_report_scope');
    result.reportId = match[1];
  }
  delete result.reportPath;
  result.recentSteps = (result.recentSteps || []).map(step => {
    const safe = { ...step }; delete safe.artifact; return safe;
  });
  if (result.failedStep) { result.failedStep = { ...result.failedStep }; delete result.failedStep.artifact; }
  return result;
}
function outcome(summary, row) {
  if (row.cancelRequested || abort.signal.aborted) return { ...summary, ok: false, reason: 'cancelled', retrySafe: false };
  if (Date.now() >= Date.parse(row.deadlineAt) || packet.deadlineNs !== undefined && process.hrtime.bigint() >= BigInt(packet.deadlineNs)) return { ...summary, ok: false, reason: 'timeout', retrySafe: false };
  return summary;
}
function terminalState(summary) {
  return summary.ok ? 'SUCCEEDED' : summary.reason === 'cancelled' ? 'CANCELLED' :
    summary.reason === 'timeout' ? 'TIMED_OUT' : ['worker_crashed', 'supervisor_failed'].includes(summary.reason) ? 'CRASHED' : 'FAILED';
}
const startupTimer = setTimeout(() => {
  process.exitCode = 1;
  if (process.connected) process.disconnect();
}, 5000);
process.once('message', async message => {
  clearTimeout(startupTimer);
  if (message?.type !== 'start') { process.exitCode = 1; if (process.connected) process.disconnect(); return; }
  packet = message;
  if (!process.connected) abort.abort();
  try {
    const { workflow, spec, digest } = captureWorkflow(packet.workflow);
    journal = await JobJournal.open(packet.journal);
    const fields = { id: packet.id, nonce: packet.nonce };
    await journal.call('verify', { id: packet.id, workflowDigest: digest });
    if (abort.signal.aborted) await journal.call('cancel', { id: packet.id });
    let row = await journal.call('read', { id: packet.id });
    if (row.total !== spec.steps.length * spec.iterations) throw new Error('invalid_metadata');
    row = await journal.call('activate', fields);
    if (row.state !== 'RUNNING') { send({ type: 'complete', job: row }); return; }
    send({ type: 'activated', job: row, pid: process.pid });
    polling = setInterval(async () => {
      if (pollBusy || journalFailed) return;
      pollBusy = true;
      try { if ((await journal.call('read', { id: packet.id })).cancelRequested) stop(); }
      catch { journalFailed = true; stop(); }
      finally { pollBusy = false; }
    }, 150);
    if (packet.deadlineNs !== undefined && (typeof packet.deadlineNs !== 'string' || !/^[0-9]{1,30}$/.test(packet.deadlineNs))) throw new Error('invalid_deadline');
    const remaining = Math.min(Date.parse(row.deadlineAt) - Date.now(), packet.deadlineNs === undefined ? Infinity : Number((BigInt(packet.deadlineNs) - process.hrtime.bigint()) / 1000000n));
    let summary;
    const preCancelled = abort.signal.aborted;
    if (remaining < 100) {
      summary = { ok: false, reason: 'timeout', completed: 0, total: row.total,
        completionCertainty: 'exact', retrySafe: false };
    } else {
      summary = await executeWorkflow({ ...workflow, timeoutMs: Math.min(spec.timeoutMs, remaining) }, {
        ...packet.execution, signal: abort.signal,
        // Ownership must be durable before the executor acknowledges worker start.
        beforeWorkerStart: ({ pid }) => write('resources', { ...fields, workerPid: pid }),
        onEvent: event => {
          if (event.type === 'ownedProcess') void write('resources', { ...fields, browserPid: event.pid }).catch(() => {});
          if (event.type === 'progress') void write('progress', { ...fields, completed: event.completed }).catch(() => {});
          if (['supervisorSpawned', 'workerSpawned', 'ownedProcess'].includes(event.type)) send({ type: event.type, pid: event.pid });
        },
      });
    }
    clearInterval(polling);
    await writes;
    if (journalFailed) throw new Error('journal_unavailable');
    row = await journal.call('read', { id: packet.id });
    summary = safeSummary(outcome(summary, row));
    const cleanupOk = remaining < 100 || preCancelled || summary.execution?.cleanup === 'terminated' &&
      ['removed', 'not-created'].includes(summary.execution.tempCleanup);
    // A cancellation or deadline can win between read and finish. Only an
    // explicit rolled-back transition rejection permits reclassification; no
    // unavailable/ambiguous mutation is ever retried and no action is replayed.
    for (let attempt = 0; ; attempt++) {
      try {
        row = await journal.call('finish', { ...fields, state: terminalState(summary), completed: summary.completed,
          cleanupOk, summary, reason: summary.reason ?? null });
        break;
      } catch (error) {
        if (attempt || error.code !== 'invalid_transition' || !summary.ok) throw error;
        row = await journal.call('read', { id: packet.id });
        summary = outcome(summary, row);
        if (summary.ok) throw error;
      }
    }
    send({ type: 'complete', job: row });
  } catch {
    // Unknown persistence outcome retains the lease for conservative recovery.
    // Browser ownership stays with executeWorkflow until its cleanup has returned.
    send({ type: 'failed', code: 'guardian_failed' });
    process.exitCode = 1;
  } finally {
    clearInterval(polling);
    if (journal) await journal.close();
    if (process.connected) process.disconnect();
  }
});

// IPC can close while the ESM graph loads, before disconnect is observed.
if (!process.connected) stop();
