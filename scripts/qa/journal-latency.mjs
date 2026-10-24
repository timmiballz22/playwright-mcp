// Trusted checkout-only QA preload. No workflow arguments, SQL or state authority.
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { JobJournal } from '../../local-batch/jobs/journal.mjs';
import { COMMAND_FIELDS } from '../../local-batch/jobs/journal-protocol.mjs';

const moduleURL = new URL(import.meta.url);
const isRoot = !moduleURL.searchParams.has('directory');
const directory = isRoot ? mkdtempSync(path.join(os.tmpdir(), 'journal-timing-')) : moduleURL.searchParams.get('directory');
moduleURL.searchParams.set('directory', directory);
const preload = '--import=' + moduleURL.href;
const endpoint = fileURLToPath(new URL('../../local-batch/jobs-mcp.mjs', import.meta.url));
const jobsDirectory = fileURLToPath(new URL('../../local-batch/jobs/', import.meta.url));
const stats = new Map();
const call = JobJournal.prototype.call;
JobJournal.prototype.call = function(command, ...args) {
  const started = performance.now();
  const promise = Reflect.apply(call, this, [command, ...args]);
  if (!COMMAND_FIELDS.has(command)) return promise;
  return promise.finally(() => {
    const ms = performance.now() - started;
    let row = stats.get(command);
    if (!row) { row = { command, count: 0, totalMs: 0, maxMs: 0, bins: [0, 0, 0, 0, 0] }; stats.set(command, row); }
    row.count++; row.totalMs += ms; row.maxMs = Math.max(row.maxMs, ms);
    row.bins[ms < 1 ? 0 : ms < 5 ? 1 : ms < 20 ? 2 : ms < 100 ? 3 : 4]++;
  });
};
// Codex does not forward NODE_OPTIONS. Explicitly instrument only these owned
// endpoint/guardian processes, preserving all existing memory flags and calls.
const spawn = childProcess.spawn;
childProcess.spawn = function(command, args, options) {
  if (Array.isArray(args) && args.includes('app-server')) {
    args = [...args];
    const index = args.indexOf('-c');
    if (index >= 0 && !args[index + 1].includes(preload)) {
      const needle = 'args=[' + JSON.stringify(endpoint) + ']';
      if (!args[index + 1].includes(needle)) throw new Error('owned_journal_timing_config_not_found');
      args[index + 1] = args[index + 1].replaceAll(needle, 'args=[' + JSON.stringify(preload) + ',' + JSON.stringify(endpoint) + ']');
    }
  }
  return Reflect.apply(spawn, this, [command, args, options]);
};
const fork = childProcess.fork;
childProcess.fork = function(modulePath, args, options) {
  const filename = modulePath instanceof URL ? fileURLToPath(modulePath) : modulePath;
  if (typeof filename === 'string' && filename.startsWith(jobsDirectory))
    options = { ...options, execArgv: [...(options?.execArgv ?? process.execArgv).filter(arg => arg !== preload), preload] };
  return Reflect.apply(fork, this, [modulePath, args, options]);
};
syncBuiltinESMExports();
process.once('exit', code => {
  const filename = path.join(directory, 'observed.jsonl');
  let removalAttempted = false, removalConfirmed = false;
  try {
    if (stats.size) appendFileSync(filename, JSON.stringify({ node: process.version, platform: process.platform, commands: [...stats.values()] }) + '\n', { mode: 0o600 });
    if (!isRoot) return;
    const raw = readFileSync(filename, 'utf8');
    if (Buffer.byteLength(raw) > 1048576) throw new Error('observation_limit');
    const rows = raw.trim().split('\n').map(line => JSON.parse(line));
    if (code === 0) { removalAttempted = true; rmSync(directory, { recursive: true, force: true }); removalConfirmed = true; }
    console.log(JSON.stringify({ fixture: 'journal_latency_observed', scope: 'completed RPCs from normally exiting instrumented processes only',
      processReceipts: rows.length, binUpperBoundsMs: [1, 5, 20, 100, 'unbounded'], rows,
      verifierExitCode: code, removalAttempted, removalConfirmed, workspace: path.basename(directory) }));
  } catch {
    if (isRoot) { console.error(JSON.stringify({ fixture: 'journal_latency_observation_failure', workspace: path.basename(directory), removalAttempted, removalConfirmed })); process.exitCode = 1; }
  }
});
