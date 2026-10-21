import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { COMMAND_FIELDS, validCommandData, JOURNAL_FAILURE_CAUSES } from './journal-protocol.mjs';

const [major, minor] = process.versions.node.split('.').map(Number);
const PROCESS_INSTANCE = randomUUID();
// SQLite became flag-free in22.13 and23.4; early23.x still needs a flag.
export const supportsJournal = major >= 24 || major === 23 && minor >= 4 || major === 22 && minor >= 13;
export class JournalError extends Error {
  constructor(code, journalFailure, journalFailureCommand) {
    super(code); this.name = 'JournalError'; this.code = code;
    if (JOURNAL_FAILURE_CAUSES.includes(journalFailure)) {
      this.journalFailure = journalFailure;
      this.journalFailureCommand = COMMAND_FIELDS.has(journalFailureCommand) ? journalFailureCommand : 'none';
    }
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
        journal.abort(); await journal.exited;
        // Only schema initialization is retried. Job mutations are never replayed.
        if (error.code !== 'journal_busy' || attempt >= 2) throw error;
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
    this.child = fork(fileURLToPath(new URL(workerModule)), [], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: ['--max-old-space-size=64'], windowsHide: true,
    });
    this.exited = new Promise(resolve => this.child.once('close', () => { this.failAll('journal_unavailable', 'worker_exit'); resolve(); }));
    this.child.once('error', () => this.abort('worker_error'));
    this.child.on('message', message => {
      if (message.type) { try { onEvent?.(message); } catch {} return; }
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id); clearTimeout(request.timer);
      if (message.ok) request.resolve(message.value);
      else {
        const code = /^[a-z_]{1,40}$/.test(message.code) ? message.code : 'journal_unavailable';
        const error = new JournalError(code, code === 'journal_unavailable' ? message.code === code ? 'worker_rejected' : 'invalid_response' : undefined, request.command);
        error.command = request.command; // Fixed internal verb only; never arguments.
        request.reject(error);
      }
    });
  }

  call(command, data = {}) {
    if (this.closed) {
      const error = new JournalError('journal_unavailable', this.failureCause ?? 'closed', this.failureCommand);
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
      const error = new JournalError(code, this.failureCause, this.failureCommand); error.command = request.command;
      request.reject(error);
    }
    this.pending.clear();
  }

  abort(cause = 'aborted', command) { this.failAll('journal_unavailable', cause, command); this.child.kill('SIGKILL'); }
  async close() {
    if (!this.closed) {
      try { await this.call('close'); } catch { this.abort(); }
    }
    await this.exited;
  }
}
