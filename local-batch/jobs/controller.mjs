import { guardianDiagnostic } from './guardian-diagnostic.mjs';
// Trusted controller; optional public MCP configuration lives in config.mjs.
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JobJournal, JournalError } from './journal.mjs';
import { captureWorkflow } from './workflow-snapshot.mjs';
import { navigationRetryPolicy } from '../navigation-retry.mjs';
import { validateExecutionPolicy } from '../policy.mjs';
import { cleanupJobArtifactsBounded as cleanupJobArtifacts } from './artifact-cleanup-supervisor.mjs';
const terminal = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT', 'CRASHED']);
const retentionCodes = new Set(['not_found', 'not_terminal', 'not_expired', 'cleanup_blocked', 'cleanup_limit', 'unsafe_artifacts', 'cleanup_timeout', 'cleanup_unconfirmed', 'cleanup_failed',
  'controller_closed', 'controller_busy', 'journal_busy', 'journal_unavailable', 'storage_full']);

export class JobController {
  static async open({ journal: config, execution = {}, onEvent } = {}) {
    const executionOptions = { ...execution,
      allowedOrigins: [...execution.allowedOrigins ?? []],
      artifactsDir: path.resolve(execution.artifactsDir ?? '.local-batch-output'),
      navigationRetry: navigationRetryPolicy(execution.navigationRetry) ?? undefined };
    const journal = await JobJournal.open(config);
    try {
      const recovered = await journal.call('recover');
      return new JobController(journal, { ...config, instanceId: journal.instanceId }, executionOptions, onEvent, recovered.cleanupBlocked);
    } catch (error) { await journal.close(); throw error; }
  }

  constructor(journal, config, execution, onEvent, blocked) {
    this.journal = journal; this.config = config; this.execution = execution;
    this.onEvent = onEvent; this.blocked = blocked;
    this.inputs = new Map(); this.operations = Promise.resolve(); this.pending = 0;
    this.closed = false; this.active = undefined; this.timer = undefined;
  }

  serialize(callback) {
    if (this.pending >= 8) return Promise.reject(new JournalError('controller_busy'));
    this.pending++;
    const task = this.operations.then(callback);
    this.operations = task.catch(() => {}).finally(() => { this.pending--; });
    return task;
  }

  notify(event) { try { this.onEvent?.(event); } catch {} }
  unavailable(error) {
    if (['journal_unavailable', 'journal_corrupt', 'storage_full'].includes(error?.code)) {
      this.blocked = true;
      // The independent guardian handles IPC loss; never kill from journal PIDs.
      if (this.active?.child.connected) this.active.child.disconnect();
    }
  }

  start(input, requestKey) {
    if (this.closed) return Promise.reject(new JournalError('controller_closed'));
    if (this.pending >= 8) return Promise.reject(new JournalError('controller_busy'));
    const acceptedAt = Date.now();
    const acceptedNs = process.hrtime.bigint();
    let snapshot;
    try { snapshot = captureWorkflow(input); validateExecutionPolicy(snapshot.spec, this.execution); }
    catch (error) { return Promise.reject(error); }
    return this.serialize(async () => {
      if (this.closed) throw new JournalError('controller_closed');
      const id = randomUUID();
      try {
        await this.expireQueued();
        const recovered = await this.journal.call('recover');
        if (recovered.cleanupBlocked) this.blocked = true;
        const row = await this.journal.call('create', { id, requestKey, workflowDigest: snapshot.digest,
          admitNew: !this.blocked && this.inputs.size < 9, requireCleanLease: true, total: snapshot.spec.steps.length * snapshot.spec.iterations, deadlineAt: acceptedAt + snapshot.spec.timeoutMs });
        // Only the winning creator retains input. Duplicate/lost replies never
        // schedule a second execution, including across controller processes.
        if (row.jobId === id && row.state === 'QUEUED') this.inputs.set(id, { workflow: snapshot.workflow, deadlineNs: acceptedNs + BigInt(snapshot.spec.timeoutMs) * 1000000n });
        this.schedule();
        return row;
      } catch (error) {
        this.unavailable(error);
        if (error.code === 'cleanup_blocked') this.blocked = true;
        if (this.blocked && error.code === 'queue_full') throw new JournalError('cleanup_blocked');
        throw error;
      }
    });
  }

  request(command, data) {
    if (this.closed) return Promise.reject(new JournalError('controller_closed'));
    return this.serialize(async () => {
      try {
        await this.expireQueued();
        if (['read', 'list', 'result', 'retention'].includes(command) && (await this.journal.call('recover')).cleanupBlocked) this.blocked = true;
        return await this.journal.call(command, data);
      }
      catch (error) { this.unavailable(error); throw error; }
    });
  }
  status(id) { return this.request('read', { id }); }
  result(id) { return this.request('result', { id }); }
  list(limit = 20) { return this.request('list', { limit }); }
  cleanup(id, dryRun = true, beforeMs) {
    if (this.cleanupUnconfirmed) return Promise.reject(new JournalError('cleanup_unconfirmed'));
    if (this.closed) return Promise.reject(new JournalError('controller_closed'));
    if (typeof dryRun !== 'boolean') return Promise.reject(new JournalError('invalid_metadata'));
    if (beforeMs !== undefined && (!Number.isSafeInteger(beforeMs) || beforeMs < 1 || beforeMs > Date.now())) return Promise.reject(new JournalError('invalid_metadata'));
    return this.serialize(async () => {
      try {
        if (this.cleanupUnconfirmed) throw new JournalError('cleanup_unconfirmed');
        const row = await this.journal.call('read', { id });
        if (!terminal.has(row.state)) throw new JournalError('not_terminal');
        if (row.operatorAttentionRequired) { this.blocked = true; throw new JournalError('cleanup_blocked'); }
        if (beforeMs !== undefined && (!Number.isFinite(Date.parse(row.updatedAt)) || Date.parse(row.updatedAt) >= beforeMs)) throw new JournalError('not_expired');
        if (!row.resultAvailable) {
          if (row.completionCertainty !== 'exact' || row.completed !== 0 || row.state === 'SUCCEEDED') throw new JournalError('cleanup_blocked');
          return { dryRun, files: 0, bytes: 0, removed: false, alreadyAbsent: true };
        }
        const summary = await this.journal.call('result', { id });
        if (!summary.runId && !summary.execution) return { dryRun, files: 0, bytes: 0, removed: false, alreadyAbsent: true };
        const nonce = randomUUID();
        await this.journal.call('cleanup_reserve', { id, nonce });
        let outcome; let failure;
        try { outcome = await cleanupJobArtifacts({ base: this.execution.artifactsDir, runId: summary.runId, dryRun }); }
        catch (error) { failure = error; }
        if (failure?.code === 'cleanup_unconfirmed') { this.blocked = true; this.cleanupUnconfirmed = true; }
        try { await this.journal.call(failure?.code === 'cleanup_unconfirmed' ? 'cleanup_uncertain' : 'cleanup_release', { id, nonce }); }
        catch (error) {
          // The durable reservation remains if acknowledgement is lost. Never
          // replay a cleanup mutation or release it from a different actor.
          this.blocked = true;
          if (failure) throw Object.assign(new AggregateError([failure, error], 'Cleanup and journal finalization failed', { cause: failure }),
            { code: error.code, journalFailure: error.journalFailure, journalFailureCommand: error.journalFailureCommand });
          throw error;
        }
        if (failure) throw failure;
        return outcome;
      } catch (error) { if (error?.code === 'cleanup_unconfirmed') { this.blocked = true; this.cleanupUnconfirmed = true; } this.unavailable(error); throw error; }
    });
  }
  async pruneArtifacts({ olderThanDays, limit = 10, afterJobId, dryRun = true, signal } = {}) {
    if (this.closed) throw new JournalError('controller_closed');
    if (!Number.isInteger(olderThanDays) || olderThanDays < 1 || olderThanDays > 3650 ||
        !Number.isInteger(limit) || limit < 1 || limit > 10 || typeof dryRun !== 'boolean' ||
        afterJobId !== undefined && (typeof afterJobId !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(afterJobId))) throw new JournalError('invalid_metadata');
    const beforeMs = Date.now() - olderThanDays * 86400000;
    if (!Number.isSafeInteger(beforeMs) || beforeMs < 1) throw new JournalError('invalid_metadata');
    const base = { dryRun, olderThanDays, before: new Date(beforeMs).toISOString() };
    if (signal?.aborted) return { ...base, results: [], interrupted: true, hasMore: null, nextAfterJobId: afterJobId ?? null, operatorAttentionRequired: !!this.blocked };
    const page = await this.request('retention', { beforeMs, limit, ...(afterJobId === undefined ? {} : { afterId: afterJobId }) });
    const results = []; let nextAfterJobId = afterJobId ?? null;
    for (const job of page.jobs) {
      if (signal?.aborted) break;
      nextAfterJobId = job.jobId;
      try { results.push({ jobId: job.jobId, ok: true, ...await this.cleanup(job.jobId, dryRun, beforeMs) }); }
      catch (error) {
        results.push({ jobId: job.jobId, ok: false, code: retentionCodes.has(error?.code) ? error.code : 'cleanup_failed' });
        if (['cleanup_unconfirmed', 'controller_busy', 'journal_busy', 'journal_unavailable', 'journal_corrupt', 'storage_full', 'controller_closed'].includes(error?.code)) break;
      }
    }
    return { ...base, results, interrupted: !!signal?.aborted,
      hasMore: page.hasMore || results.length < page.jobs.length, nextAfterJobId, operatorAttentionRequired: !!this.blocked };
  }
  async cancel(id) {
    const row = await this.request('cancel', { id });
    if (terminal.has(row.state)) this.inputs.delete(id);
    this.schedule();
    return row;
  }

  async expireQueued() {
    for (const [id, input] of this.inputs) {
      if (id === this.active?.id || process.hrtime.bigint() < input.deadlineNs) continue;
      const row = await this.journal.call('read', { id });
      if (row.state === 'QUEUED') {
        const stopped = await this.journal.call('reserve', { id, nonce: randomUUID(), queueExpired: true });
        if (!stopped.acquired && stopped.reason === 'not_started') this.inputs.delete(id);
      } else if (terminal.has(row.state)) this.inputs.delete(id);
    }
  }

  schedule(milliseconds = 0) {
    if (this.closed || this.blocked || this.active || this.timer || !this.inputs.size) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.serialize(() => this.pump()).catch(error => {
        if (error.code === 'controller_busy') this.schedule(100);
        else { this.blocked = true; this.unavailable(error); }
      });
    }, milliseconds);
    this.timer.unref();
  }

  async pump() {
    if (this.closed || this.blocked || this.active || !this.inputs.size) return;
    await this.expireQueued();
    if (!this.inputs.size) return;
    const [id, input] = this.inputs.entries().next().value;
    const { workflow, deadlineNs } = input;
    const row = await this.journal.call('read', { id });
    if (row.state !== 'QUEUED') { this.inputs.delete(id); this.schedule(); return; }
    const nonce = randomUUID();
    const reserved = await this.journal.call('reserve', { id, nonce });
    if (!reserved.acquired) {
      if (reserved.reason === 'cleanup_blocked') this.blocked = true;
      if (reserved.reason === 'not_started') this.inputs.delete(id);
      this.schedule(100); return;
    }
    let child;
    try {
      child = fork(fileURLToPath(new URL('./guardian.mjs', import.meta.url)), [], {
        detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        execArgv: ['--max-old-space-size=128'], windowsHide: true,
      });
    } catch {
      await this.journal.call('finish', { id, nonce, state: 'FAILED', completed: 0, cleanupOk: true, reason: 'execution_failed' });
      this.inputs.delete(id); this.schedule(); return;
    }
    let resolveDone;
    const active = { id, nonce, child, done: new Promise(resolve => { resolveDone = resolve; }) };
    this.active = active;
    this.notify({ type: 'guardianSpawned', jobId: id, pid: child.pid });
    child.on('message', event => {
      if (event?.type === 'failed') {
        const diagnostic = guardianDiagnostic(event.diagnostic, event.diagnostic?.stage, event.diagnostic?.command);
        if (diagnostic.journalExitConfirmed === false) this.blocked = true;
        this.notify({ type: 'guardianFailed', diagnostic });
      }
      if (['supervisorSpawned', 'workerSpawned', 'ownedProcess'].includes(event?.type) && Number.isInteger(event.pid) && event.pid > 1)
        this.notify({ type: event.type, jobId: id, pid: event.pid });
    });
    let handled = false;
    const exited = (code, signal) => {
      if (handled) return;
      handled = true;
      if (code !== 0) this.notify({ type: 'guardianExited', code: Number.isInteger(code) ? code : null, signal: ['SIGKILL', 'SIGTERM', 'SIGABRT', 'SIGSEGV', 'SIGINT'].includes(signal) ? signal : 'none' });
      // Drain IPC before finalizing, including an unconfirmed journal-exit
      // diagnostic which may arrive after the process exit notification.
      const finalize = async () => {
        try {
          let current = await this.journal.call('read', { id });
          if (current.state === 'QUEUED') {
            // No activation/worker effects occurred; the controller still holds
            // the reservation. A known child exit permits exact-zero failure.
            const state = current.cancelRequested ? 'CANCELLED' : Date.now() >= Date.parse(current.deadlineAt) ? 'TIMED_OUT' : 'FAILED';
            current = await this.journal.call('finish', { id, nonce, state, completed: 0, cleanupOk: true,
              reason: state === 'CANCELLED' ? 'cancelled' : state === 'TIMED_OUT' ? 'timeout' : 'execution_failed' });
          } else if (!terminal.has(current.state)) {
            await this.journal.call('recover');
            current = await this.journal.call('read', { id });
          }
          if (!terminal.has(current.state) || current.operatorAttentionRequired) this.blocked = true;
          if (terminal.has(current.state)) this.notify({ type: 'jobComplete', jobId: id, state: current.state });
        } catch (error) { this.blocked = true; this.unavailable(error); }
        finally {
          this.inputs.delete(id); this.active = undefined;
          resolveDone(); this.schedule();
        }
      };
      // Lifecycle bookkeeping cannot be shed by the public admission bound.
      this.operations = this.operations.then(finalize, finalize);
    };
    // IPC-only forks may omit close after parent-initiated disconnect.
    // Both exit and disconnect receipts are needed; neither alone is enough.
    let exitReceipt; let ipcDrained = !child.connected;
    const finalizeDrained = () => { if (exitReceipt && ipcDrained) exited(...exitReceipt); };
    child.once('exit', (...receipt) => { exitReceipt = receipt; finalizeDrained(); });
    child.once('disconnect', () => { ipcDrained = true; finalizeDrained(); });
    child.once('error', () => {
      if (!child.pid) exited();
      else if (child.connected) child.disconnect();
    });
    child.send({ type: 'start', id, nonce, journal: this.config, workflow, execution: this.execution, deadlineNs: String(deadlineNs) }, error => {
      if (error && child.connected) child.disconnect();
    });
  }

  close() {
    if (this.closing) return this.closing;
    this.closed = true; clearTimeout(this.timer); this.timer = undefined;
    this.closing = this.closeOwned();
    return this.closing;
  }
  async closeOwned() {
    // Queue behind admitted operations without waiting inside the queue for an
    // exit handler which itself needs that queue.
    const prepare = async () => {
      for (const id of this.inputs.keys()) {
        try { await this.journal.call('cancel', { id }); }
        catch (error) { this.blocked = true; this.unavailable(error); }
      }
      if (this.active?.child.connected) this.active.child.disconnect();
      return this.active;
    };
    const pending = this.operations.then(prepare, prepare);
    this.operations = pending.then(() => {});
    const active = await pending;
    let timer; let exited = !active;
    if (active) {
      exited = await Promise.race([active.done.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 10000); })]);
      clearTimeout(timer);
      if (!exited) active.child.unref();
    }
    this.inputs.clear();
    await this.journal.close();
    return { closed: true, cleanupConfirmed: exited && !this.blocked };
  }
}
