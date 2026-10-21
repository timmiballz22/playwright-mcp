#!/usr/bin/env node
import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { JobController } from './jobs/controller.mjs';
import { supportsJournal } from './jobs/journal.mjs';
import { resolveJobConfig } from './jobs/config.mjs';
import { readWorkflowFile } from './workflow-file.mjs';
import { validateWorkflow } from './runner.mjs';
const terminal = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT', 'CRASHED']);
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const invalid = () => { throw new TypeError('invalid_arguments'); };
export function parseJobArguments(argv) {
  const [command, ...rest] = argv;
  const fields = { start: ['--workflow', '--request-key'], status: ['--job-id'], result: ['--job-id', '--wait-ms'], cancel: ['--job-id'], list: ['--limit'], cleanup: ['--job-id', '--delete'] };
  if (!Object.hasOwn(fields, command)) invalid();
  const result = { command }; const seen = new Set();
  if (command === 'cleanup') { result.jobIds = []; result.dryRun = true; }
  for (let index = 0; index < rest.length; index++) {
    const flag = rest[index];
    if (!fields[command].includes(flag) || seen.has(flag) && !(command === 'cleanup' && flag === '--job-id')) invalid();
    seen.add(flag);
    if (flag === '--delete') { result.dryRun = false; continue; }
    const value = rest[++index]; if (typeof value !== 'string' || !value.length) invalid();
    if (flag === '--job-id') {
      if (!uuid.test(value)) invalid();
      if (command === 'cleanup') result.jobIds.push(value); else result.jobId = value;
    } else if (flag === '--wait-ms' || flag === '--limit') {
      if (!/^\d{1,5}$/.test(value)) invalid();
      const number = Number(value);
      if (flag === '--wait-ms') { if (number > 10000) invalid(); result.waitMs = number; }
      else { if (number < 1 || number > 20) invalid(); result.limit = number; }
    } else if (flag === '--workflow') result.workflow = value;
    else if (flag === '--request-key') { if (value.length > 128) invalid(); result.requestKey = value; }
  }
  if (command === 'start' && (!result.workflow || !result.requestKey) || ['status', 'result', 'cancel'].includes(command) && !result.jobId || command === 'cleanup' && (!result.jobIds.length || result.jobIds.length > 10 || new Set(result.jobIds).size !== result.jobIds.length)) invalid();
  return result;
}
const safeCodes = new Set(['not_found', 'not_terminal', 'cleanup_blocked', 'cleanup_limit', 'unsafe_artifacts', 'queue_full', 'history_full', 'idempotency_conflict', 'controller_busy', 'journal_busy', 'journal_unavailable', 'storage_full', 'request_cancelled', 'wait_expired', 'unsupported_runtime', 'unsupported_private_storage', 'invalid_owner', 'invalid_policy', 'invalid_storage', 'invalid_project', 'unsafe_storage']);
const safeCode = error => safeCodes.has(error?.code) ? error.code : 'jobs_failed';
const emit = value => process.stdout.write(JSON.stringify(value) + '\n');
async function main() {
  const options = parseJobArguments(process.argv.slice(2));
  if (!supportsJournal) throw Object.assign(new Error(), { code: 'unsupported_runtime' });
  let interrupted = false; let controller; let started;
  const cancel = () => { interrupted = true; };
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  try {
    const config = await resolveJobConfig();
    if (interrupted) throw Object.assign(new Error(), { code: 'request_cancelled' });
    controller = await JobController.open(config);
    if (interrupted) throw Object.assign(new Error(), { code: 'request_cancelled' });
    if (options.command === 'start') {
      const workflow = await readWorkflowFile(options.workflow);
      const spec = validateWorkflow(workflow);
      if (interrupted) throw Object.assign(new Error(), { code: 'request_cancelled' });
      started = await controller.start(workflow, options.requestKey);
      emit({ event: 'accepted', job: started });
      const end = performance.now() + spec.timeoutMs + 15000;
      let job = started; let cancelPersisted = false;
      while (!terminal.has(job.state)) {
        if (interrupted && !cancelPersisted) { await controller.cancel(job.jobId); cancelPersisted = true; }
        if (performance.now() >= end) throw Object.assign(new Error(), { code: 'wait_expired' });
        await delay(250); job = await controller.status(job.jobId);
      }
      emit({ event: 'complete', job, result: job.resultAvailable ? await controller.result(job.jobId) : null });
      if (job.state !== 'SUCCEEDED') process.exitCode = 1;
    } else if (options.command === 'status') emit(await controller.status(options.jobId));
    else if (options.command === 'cancel') emit(await controller.cancel(options.jobId));
    else if (options.command === 'list') emit({ jobs: await controller.list(options.limit ?? 20) });
    else if (options.command === 'result') {
      const end = performance.now() + (options.waitMs ?? 0); let job;
      do {
        job = await controller.status(options.jobId);
        if (terminal.has(job.state) || performance.now() >= end || interrupted) break;
        await delay(Math.min(250, Math.max(1, end - performance.now())));
      } while (true);
      emit({ job, ready: terminal.has(job.state), result: job.resultAvailable ? await controller.result(job.jobId) : null });
    } else {
      const results = [];
      for (const jobId of options.jobIds) {
        if (interrupted) break;
        try { results.push({ jobId, ok: true, ...await controller.cleanup(jobId, options.dryRun) }); }
        catch (error) { results.push({ jobId, ok: false, code: safeCode(error) }); process.exitCode = 1; }
      }
      emit({ results, interrupted });
    }
  } finally {
    try {
      if (interrupted && started) await controller?.cancel(started.jobId).catch(() => {});
      if (controller && !(await controller.close()).cleanupConfirmed) process.exitCode = 1;
    } finally { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
  }
}
// Node canonicalizes ESM entry URLs, including macOS /var -> /private/var.
// Compare canonical paths so an aliased installation still executes the CLI.
const invokedPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => undefined) : undefined;
if (invokedPath && invokedPath === await realpath(fileURLToPath(import.meta.url))) main().catch(error => {
  process.stderr.write('Local jobs CLI failed (' + safeCode(error) + '). Check command, trusted configuration and runtime.\n');
  process.exitCode = 1;
});
