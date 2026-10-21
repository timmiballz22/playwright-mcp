// Actual Codex app-server protocol, zero model turns. Temporary -c configuration
// only; no global client config edits. Requires Node22.13+ and Codex CLI.
import { stepFailureDiagnostic } from './step-failure-diagnostic.mjs';
import { COMMAND_FIELDS, JOURNAL_FAILURE_CAUSES } from '../local-batch/jobs/journal-protocol.mjs';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { supportsJournal } from '../local-batch/jobs/journal.mjs';
import { ownedDescendants } from '../local-batch/fixtures/process-audit.mjs';
import { reportedProcessStateHint } from '../local-batch/fixtures/process-state-hint.mjs';
import { terminateOwnedProcesses, TERMINATION_FAILURE_CODES } from '../local-batch/process-tree.mjs';
if (!supportsJournal) throw new Error('Unsupported jobs preview runtime/platform');
const root = fileURLToPath(new URL('../', import.meta.url));
const codex = process.argv[2] ?? 'codex';
const codexCommand = codex.endsWith('.js') ? process.execPath : codex;
const codexArguments = codex.endsWith('.js') ? [codex] : [];
const version = (await promisify(execFile)(codexCommand, [...codexArguments, '--version'], { timeout: 10000, maxBuffer: 4096 })).stdout.trim();
assert.match(version, /^codex-cli [0-9.]+/);
const directory = await mkdtemp(path.join(os.tmpdir(), 'codex-jobs-'));
const fixture = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end('<title>Owned jobs fixture</title><button>Add</button><output>0</output><script>let n=0;document.querySelector("button").onclick=()=>document.querySelector("output").textContent=String(++n)</script>');
});
fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
const origin = `http://127.0.0.1:${fixture.address().port}`;
const owner = randomUUID();
const environment = id => ({ PLAYWRIGHT_JOBS_OWNER_ID: id, PLAYWRIGHT_JOBS_DATA_DIR: path.join(directory, 'state'), PLAYWRIGHT_JOBS_PROJECT_DIR: directory, PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: origin, PLAYWRIGHT_JOBS_ALLOW_MUTATIONS: '1', PLAYWRIGHT_JOBS_ALLOW_SENSITIVE_ARTIFACTS: '0' });
const table = entries => '{' + Object.entries(entries).map(([key, value]) => key + '=' + JSON.stringify(value)).join(',') + '}';
const server = id => `{command=${JSON.stringify(process.execPath)},args=[${JSON.stringify(path.join(root, 'local-batch/jobs-mcp.mjs'))}],env=${table(environment(id))}}`;
const config = `mcp_servers={jobs=${server(owner)},foreign_jobs=${server(randomUUID())}}`;
const child = spawn(codexCommand, [...codexArguments, 'app-server', '--stdio', '-c', config], { cwd: root, detached: true, stdio: ['pipe', 'pipe', 'pipe'],
  // Pinned client logs server stderr at this target. Raw lines stay in our
  // bounded private buffer; only the endpoint's fixed startup code is emitted.
  env: { ...process.env, RUST_LOG: [process.env.RUST_LOG, 'codex_rmcp_client::stdio_server_launcher=info'].filter(Boolean).join(',') },
});
const closed = once(child, 'close').catch(() => []);
// Keep raw client diagnostics private; emit only our fixed startup code format.
const guardianFailures = new Set(); const guardianExits = new Set(); const journalFailures = new Set();
const rememberJournalFailures = value => {
  for (const match of value.matchAll(/Local job journal unavailable \(([a-z_]+)\/([a-z_]+)\)/g))
    if (journalFailures.size < 16 && JOURNAL_FAILURE_CAUSES.includes(match[1]) && (match[2] === 'none' || COMMAND_FIELDS.has(match[2]))) journalFailures.add(match.slice(1).join('/'));
};
const startupCodes = new Set(); const helperFailures = new Set(); const startupStates = new Map(); let stderrTail = '';
const startupCategory = value => {
  if (typeof value !== 'string') return undefined;
  if (/Local jobs startup failed \([a-z_]{1,40}\)/.test(value)) return 'jobs_startup_rejected';
  if (/os error (?:5|13)\b|access is denied|permission denied/i.test(value)) return 'access_denied';
  if (/os error 2\b|program not found|no such file/i.test(value)) return 'launcher_or_file_missing';
  if (/timed out|timeout/i.test(value)) return 'startup_timeout';
  if (/initialize response|handshak/i.test(value)) return 'handshake_failed';
  return 'unclassified_startup_error';
};
child.stderr.on('data', chunk => {
  stderrTail = (stderrTail + chunk.toString()).slice(-4096);
  rememberJournalFailures(stderrTail);
  for (const match of stderrTail.matchAll(/Local job guardian failed \(([a-z_]+)\/([a-z_]+)\/([a-z_]+)\)/g)) guardianFailures.add(match.slice(1).join('/'));
  for (const match of stderrTail.matchAll(/Local job guardian exited \((unknown|-?[0-9]+)\/(none|SIGKILL|SIGTERM|SIGABRT|SIGSEGV|SIGINT)\)/g)) guardianExits.add(match.slice(1).join('/'));
  for (const match of stderrTail.matchAll(/Local jobs startup failed \(([a-z_]{1,40})\)/g)) startupCodes.add(match[1]);
  for (const match of stderrTail.matchAll(/Local private storage helper failed \((spawn_missing|spawn_denied|output_limit|timeout|nonzero_exit|spawn_failed|invalid_output)\)/g)) helperFailures.add(match[1]);
});
const lines = createInterface({ input: child.stdout });
const pending = new Map(); let next = 1; let observed = [];
const rejectPending = () => { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Codex transport closed')); } pending.clear(); };
child.once('close', rejectPending); child.once('error', rejectPending); child.stdin.on('error', rejectPending);
lines.on('line', line => {
  let packet;
  try { packet = JSON.parse(line); } catch { rejectPending(); return; }
  if (packet.method === 'mcpServer/startupStatus/updated') {
    const value = packet.params;
    if (['jobs', 'foreign_jobs'].includes(value?.name) && typeof value.error === 'string') {
      rememberJournalFailures(value.error);
      for (const match of value.error.matchAll(/Local jobs startup failed \(([a-z_]{1,40})\)/g)) startupCodes.add(match[1]);
    }
    if (['jobs', 'foreign_jobs'].includes(value?.name) && ['starting', 'ready', 'failed', 'cancelled'].includes(value?.status))
      startupStates.set(value.name, { status: value.status, errorPresent: typeof value.error === 'string', category: startupCategory(value.error), reauthenticationRequired: value.failureReason === 'reauthenticationRequired' });
  }
  const item = pending.get(packet.id); if (!item) return;
  pending.delete(packet.id); clearTimeout(item.timer);
  if (packet.error) {
    const error = new Error('Codex RPC failed'); error.method = item.method;
    if (Number.isSafeInteger(packet.error.code)) error.rpcCode = packet.error.code;
    if (process.env.GITHUB_ACTIONS === 'true') console.error('::error title=Codex RPC phase::' + JSON.stringify({ method: error.method, code: error.rpcCode }));
    item.reject(error);
  } else item.resolve(packet.result);
});
const send = packet => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...packet }) + '\n');
const rpc = (method, params, timeoutMs = 20000) => new Promise((resolve, reject) => {
  const id = next++; const timer = setTimeout(() => { pending.delete(id); reject(new Error('Codex RPC timed out')); }, timeoutMs);
  pending.set(id, { resolve, reject, timer, method }); send({ id, method, params });
});
let verified;
try {
  await rpc('initialize', { clientInfo: { name: 'local-jobs-acceptance', version: '1.0.0' }, capabilities: { experimentalApi: true } });
  send({ method: 'initialized', params: {} });
  const { thread } = await rpc('thread/start', { cwd: root, ephemeral: true, sandbox: 'workspace-write', approvalPolicy: 'never' });
  const call = async (tool, args, name = 'jobs') => {
    const result = await rpc('mcpServer/tool/call', { threadId: thread.id, server: name, tool, arguments: args });
    assert.notEqual(result.isError, true, 'Actual Codex jobs tool returned an error');
    return JSON.parse(result.content[0].text);
  };
  const expectedTools = ['start_workflow', 'get_workflow_status', 'get_workflow_result', 'cancel_workflow', 'list_workflows', 'cleanup_workflows'].sort();
  for (const name of ['jobs', 'foreign_jobs']) {
    const discoveryEnd = performance.now() + 20000;
    let tools = []; let polls = 0;
    do {
      const inventory = await rpc('mcpServerStatus/list', { threadId: thread.id, serverName: name, detail: 'toolsAndAuthOnly' }, Math.max(1, discoveryEnd - performance.now()));
      const registered = inventory.data.find(item => item.name === name);
      tools = Object.keys(registered?.tools ?? {}).sort(); polls++;
      if (tools.length || startupCodes.size || ['failed', 'cancelled'].includes(startupStates.get(name)?.status) || performance.now() >= discoveryEnd) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    } while (polls < 100);
    const diagnostic = JSON.stringify({ server: name, tools: tools.length, polls, startup: startupStates.get(name), startupCodes: [...startupCodes].sort(), helperFailures: [...helperFailures].sort(), journalFailures: [...journalFailures].sort() });
    if (process.env.GITHUB_ACTIONS === 'true') console.error('::notice title=Codex tool discovery::' + diagnostic);
    assert.deepEqual(tools, expectedTools, diagnostic);
  }
  const input = { requestKey: 'codex-1000', workflow: { timeoutMs: 120000, steps: [
    { type: 'goto', url: origin }, { type: 'click', selector: { role: 'button', name: 'Add' }, repeat: 997 },
    { type: 'assertText', selector: 'output', equals: '997' }, { type: 'assertURL', url: origin + '/' },
  ] } };
  const startedAt = performance.now();
  const first = await call('start_workflow', input); const startMs = Math.round(performance.now() - startedAt);
  assert.ok(startMs < 5000, 'Actual client start occupied long execution');
  assert.equal((await call('start_workflow', input)).jobId, first.jobId);
  observed = await ownedDescendants([child.pid], { rememberLiveRoots: true });
  const foreign = await rpc('mcpServer/tool/call', { threadId: thread.id, server: 'foreign_jobs', tool: 'get_workflow_status', arguments: { jobId: first.jobId } });
  assert.equal(foreign.isError, true); assert.equal(JSON.parse(foreign.content[0].text).code, 'not_found');
  let result; let resultCalls = 0; const end = performance.now() + 130000;
  do { resultCalls++; result = await call('get_workflow_result', { jobId: first.jobId, waitMs: 10000 }); } while (!result.ready && performance.now() < end);
  const cleanupProcessHint = result.result?.execution?.cleanup === 'failed' ? await reportedProcessStateHint([result.result.execution.supervisorPid, result.result.execution.workerPid, ...(Array.isArray(result.result.execution.browserPids) ? result.result.execution.browserPids : [])]) : undefined;
  const receipt = JSON.stringify({ phase: 'codex_primary_job', failedStep: stepFailureDiagnostic(result.result?.failedStep), state: result.job?.state, jobReason: result.job?.reason, jobStage: result.job?.stage, jobCompleted: result.job?.completed, resultAvailable: !!result.result, operatorAttentionRequired: result.job?.operatorAttentionRequired, guardianFailures: [...guardianFailures], journalFailures: [...journalFailures].sort(), guardianExits: [...guardianExits], forced: result.result?.execution?.forced, workerCleanupFailed: result.result?.execution?.workerCleanupFailed, cleanupProcessHint, terminationFailures: Array.isArray(result.result?.execution?.terminationFailures) ? result.result.execution.terminationFailures.filter(code => TERMINATION_FAILURE_CODES.includes(code)).slice(0, 8) : undefined, completed: result.result?.completed, reason: result.result?.reason, cleanup: result.result?.execution?.cleanup, tempCleanup: result.result?.execution?.tempCleanup });
  if (process.env.GITHUB_ACTIONS === 'true' && result.job?.state !== 'SUCCEEDED') console.error('::error title=Codex jobs receipt::' + receipt.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
  assert.equal(result.job.state, 'SUCCEEDED', receipt); assert.equal(result.result.completed, 1000);
  assert.equal(result.result.recentSteps.length, 10); assert.equal(result.result.reportPath, undefined);
  assert.equal((await call('get_workflow_status', { jobId: first.jobId })).state, 'SUCCEEDED');
  assert.ok((await call('list_workflows', { limit: 2 })).jobs.some(job => job.jobId === first.jobId));
  assert.equal((await call('cleanup_workflows', { jobIds: [first.jobId] })).results[0].dryRun, true);
  assert.equal((await call('cleanup_workflows', { jobIds: [first.jobId], dryRun: false })).results[0].removed, true);
  assert.equal((await call('start_workflow', input)).jobId, first.jobId);
  const cancellable = await call('start_workflow', { requestKey: 'codex-cancel', workflow: { timeoutMs: 20000, actionTimeoutMs: 15000, steps: [{ type: 'goto', url: origin }, { type: 'waitFor', selector: '#not-present' }] } });
  let running; const cancelEnd = performance.now() + 10000;
  do { running = await call('get_workflow_status', { jobId: cancellable.jobId }); if (running.completed === 1) break; await new Promise(resolve => setTimeout(resolve, 50)); } while (performance.now() < cancelEnd);
  assert.equal(running.state, 'RUNNING'); assert.equal(running.completed, 1);
  observed.push(...await ownedDescendants([child.pid], { rememberLiveRoots: true }));
  assert.equal((await call('cancel_workflow', { jobId: cancellable.jobId })).cancelRequested, true);
  const cancelled = await call('get_workflow_result', { jobId: cancellable.jobId, waitMs: 10000 });
  assert.equal(cancelled.job.state, 'CANCELLED'); assert.equal(cancelled.job.completed, 1); assert.equal(cancelled.job.operatorAttentionRequired, false);
  verified = { client: version, os: process.platform, launcher: codexArguments.length ? 'node' : 'native', tools: 6, completed: 1000, startMs, resultCalls, durationMs: Math.round(performance.now() - startedAt), duplicateExecuted: false, foreignOwnerDenied: true, terminalCleanup: true, activeCancel: true, cancelledJobCompleted: cancelled.job.completed, modelTurns: 0, temporaryConfigOnly: true };
} finally {
  let clean = false;
  try {
    observed.push(...await ownedDescendants([child.pid], { rememberLiveRoots: true }));
    rejectPending(); child.stdin.end();
    let timer;
    const exited = await Promise.race([closed.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 3000); })]);
    clearTimeout(timer);
    if (!exited) await terminateOwnedProcesses(child.pid, [], child.exitCode === null && child.signalCode === null);
    const end = performance.now() + 10000;
    while ((await ownedDescendants([child.pid, ...observed])).length && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepEqual(await ownedDescendants([child.pid, ...observed]), []); clean = true;
  } finally {
    try {
      rejectPending();
      if (child.exitCode === null && child.signalCode === null) await terminateOwnedProcesses(child.pid, [], true);
    } finally {
      lines.close(); fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
      // Failed verification retains private artifacts even after a clean audit.
      if (clean && verified) await rm(directory, { recursive: true, force: true });
    }
  }
}
console.log(JSON.stringify({ ...verified, activeOwnedProcesses: 0 }));
