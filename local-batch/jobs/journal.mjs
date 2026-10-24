import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { COMMAND_FIELDS, validCommandData, JOURNAL_FAILURE_CAUSES, JOURNAL_INIT_STAGES } from './journal-protocol.mjs';

const [major, minor] = process.versions.node.split('.').map(Number);
const PROCESS_INSTANCE = randomUUID();
// SQLite became flag-free in22.13 and23.4; early23.x still needs a flag.
export const supportsJournal = major >= 24 || major === 23 && minor >= 4 || major === 22 && minor >= 13;
export class JournalError extends Error {
  constructor(code, journalFailure, journalFailureCommand, journalExitConfirmed, journalInitStage) {
    super(code); this.name = 'JournalError'; this.code = code;
    if (JOURNAL_FAILURE_CAUSES.includes(journalFailure)) {
      this.journalFailure = journalFailure;
      this.journalFailureCommand = COMMAND_FIELDS.has(journalFailureCommand) ? journalFailureCommand : 'none';
    }
    if (typeof journalExitConfirmed === 'boolean') this.journalExitConfirmed = journalExitConfirmed;
    if (JOURNAL_INIT_STAGES.includes(journalInitStage)) this.journalInitStage = journalInitStage;
  }
}

// Trusted source API. Worker modules and events cannot come from tool arguments.
export class JobJournal {
  static async open(options = {}) {
    if (!supportsJournal) throw new JournalError('unsupported_runtime');
    const instanceId = options.instanceId ?? PROCESS_INSTANCE;
    for (let attempt = 0; ; attempt++) {
      const journal = new JobJournal({ ...options, instanceId });
      try {
        await journal.call('init', { directory: options.directory, projectId: options.projectId,
          ownerId: options.ownerId, instanceId, pid: process.pid });
        return journal;
      } catch (error) {
        journal.abort();
        const confirmed = await journal.waitForExit();
        error.journalExitConfirmed = confirmed;
        if (!confirmed) { journal.detachUnknownWorker(); throw error; }
        // Only initialization is retried, after the owned worker actually closes.
        // COMMIT may have completed before its ready/ACK reaches the parent.
        // A fresh worker revalidates the store; it never replays job mutations.
        const commitTimeout = error.code === 'journal_unavailable' && error.journalFailure === 'rpc_timeout' &&
          error.journalFailureCommand === 'init' && error.journalInitStage === 'schema_commit';
        if (error.code !== 'journal_busy' && !commitTimeout || attempt >= 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 20 * 2 ** attempt));
      }
    }
  }

  constructor({ instanceId = PROCESS_INSTANCE, timeoutMs = 2000,
    workerModule = new URL('./journal-worker.mjs', import.meta.url), onEvent } = {}) {
    if (!supportsJournal) throw new JournalError('unsupported_runtime');
    this.instanceId = instanceId;
    this.timeoutMs = timeoutMs;
    this.pending = new Map();
    this.nextId = 1;
    this.closed = false;
    this.initStage = 'not_observed';
    this.child = fork(fileURLToPath(new URL(workerModule)), [], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: ['--max-old-space-size=64'], windowsHide: true,
    });
    this.child.once('spawn', () => { if (this.initStage === 'not_observed') this.initStage = 'spawned'; });
    this.exited = new Promise(resolve => this.child.once('close', () => { this.exitConfirmed = true; this.failAll('journal_unavailable', 'worker_exit'); resolve(); }));
    this.child.once('error', () => this.abort('worker_error'));
    this.child.on('message', message => {
      if (!message || typeof message !== 'object' || Array.isArray(message)) { this.abort('invalid_response'); return; }
      if (message.type === 'journal_init_phase') {
        if (Object.keys(message).length !== 3 || !Number.isSafeInteger(message.id) || message.id < 1 ||
            !JOURNAL_INIT_STAGES.includes(message.stage) || ['not_observed','spawned'].includes(message.stage)) {
          this.abort('invalid_response'); return;
        }
        if (this.pending.get(message.id)?.command === 'init') this.initStage = message.stage;
        return;
      }
      if (message.type) { try { onEvent?.(message); } catch {} return; }
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id); clearTimeout(request.timer);
      if (message.ok) request.resolve(message.value);
      else {
        const code = /^[a-z_]{1,40}$/.test(message.code) ? message.code : 'journal_unavailable';
        const error = new JournalError(code, code === 'journal_unavailable' ? message.code === code ? 'worker_rejected' : 'invalid_response' : undefined, request.command, undefined, request.command === 'init' ? this.initStage : undefined);
        error.command = request.command; // Fixed internal verb only; never arguments.
        request.reject(error);
      }
    });
  }

  call(command, data = {}) {
    if (this.closed) {
      const error = new JournalError('journal_unavailable', this.failureCause ?? 'closed', this.failureCommand, this.exitConfirmed, this.failureCommand === 'init' ? this.initStage : undefined);
      if (COMMAND_FIELDS.has(command)) error.command = command;
      return Promise.reject(error);
    }
    if (!COMMAND_FIELDS.has(command)) return Promise.reject(new JournalError('unsupported_command'));
    if (!validCommandData(command, data)) return Promise.reject(new JournalError('invalid_metadata'));
    if (this.pending.size >= 32) return Promise.reject(new JournalError('journal_busy'));
    try { if (Buffer.byteLength(JSON.stringify(data)) > 262144) return Promise.reject(new JournalError('metadata_too_large')); }
    catch { return Promise.reject(new JournalError('invalid_metadata')); }
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => this.abort('rpc_timeout', command), this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer, command });
      this.child.send({ id, command, data }, error => { if (error) this.abort('send_failure', command); });
    });
  }

  failAll(code, cause, command) {
    if (!this.failureCause && JOURNAL_FAILURE_CAUSES.includes(cause)) {
      this.failureCause = cause; this.failureCommand = COMMAND_FIELDS.has(command) ? command : undefined;
    }
    this.closed = true;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      const error = new JournalError(code, this.failureCause, this.failureCommand, this.exitConfirmed, request.command === 'init' || this.failureCommand === 'init' ? this.initStage : undefined); error.command = request.command;
      request.reject(error);
    }
    this.pending.clear();
  }

  abort(cause = 'aborted', command) {
    this.failAll('journal_unavailable', cause, command);
    try { this.child.kill('SIGKILL'); } catch {}
  }
  async waitForExit() {
    let timer;
    const exited = await Promise.race([this.exited.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 1000); })]);
    clearTimeout(timer);
    this.exitConfirmed = exited || this.exitConfirmed === true;
    return this.exitConfirmed;
  }
  detachUnknownWorker() {
    // No PID-based fallback or successful shutdown claim. Release only the
    // parent's event-loop references after bounded owned-handle termination.
    if (this.child.connected) { try { this.child.disconnect(); } catch {} }
    this.child.unref();
  }
  async close() {
    if (!this.closing) this.closing = this.closeWorker();
    return this.closing;
  }
  async closeWorker() {
    if (!this.closed) {
      try { await this.call('close'); } catch { this.abort(); }
    }
    const alreadyStopped = this.closed;
    if (await this.waitForExit()) return;
    if (!alreadyStopped) {
      this.abort('closed', 'close');
      if (await this.waitForExit()) return;
    }
    this.detachUnknownWorker();
    const error = new JournalError('journal_unavailable', this.failureCause ?? 'closed', this.failureCommand, false, this.failureCommand === 'init' ? this.initStage : undefined);
    error.command = 'close';
    throw error;
  }
}
