import { test } from 'node:test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolveJobConfig } from './jobs/config.mjs';
import { JobJournal, supportsJournal } from './jobs/journal.mjs';
import { guardianDiagnostic, guardianStderrFacts } from './jobs/guardian-diagnostic.mjs';
import { ownedScopeDescendants } from './fixtures/process-audit.mjs';
const entry = fileURLToPath(new URL('./jobs-mcp.mjs', import.meta.url));
if (supportsJournal) test('preview stdio jobs: durable IDs, duplicate admission, isolation, cancellation and reconnect', { timeout: 180000 }, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jobs-mcp-'));
  const owner = randomUUID(); const clients = []; const scopes = [];
  let verified = false; let primaryFailure;
  const diagnosticSets = { guardianFailures: new Set(), journalFailures: new Set(), guardianExits: new Set() };
  let diagnosticCapped = false; let journalExitUnconfirmed = false; let stderrTailTruncated = false;
  const server = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<div id="ready">ready</div><button>Add</button><output>0</output><script>let n=0;document.querySelector("button").onclick=()=>document.querySelector("output").textContent=String(++n)</script>'); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function open(ownerId = owner, mutations = false, maxScreenshotBytes) {
    const client = new Client({ name: 'jobs-acceptance', version: '1.0.0' });
    const transport = new StdioClientTransport({ command: process.execPath, args: [entry], stderr: 'pipe', env: {
      ...process.env, PLAYWRIGHT_JOBS_ALLOW_MUTATIONS: mutations ? '1' : '0', PLAYWRIGHT_JOBS_ALLOW_SENSITIVE_ARTIFACTS: maxScreenshotBytes === undefined ? '0' : '1', PLAYWRIGHT_JOBS_MAX_SCREENSHOT_BYTES: String(maxScreenshotBytes ?? 16777216), PLAYWRIGHT_JOBS_OWNER_ID: ownerId, PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'data'), PLAYWRIGHT_JOBS_PROJECT_DIR: root, PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: origin,
    } });
    // Consume the pipe from construction so a full stderr buffer cannot stall
    // this client. Only fixed endpoint facts can leave the private tail buffer.
    let stderrTail = '';
    transport.stderr.on('data', chunk => {
      const value = stderrTail + chunk.toString(); stderrTailTruncated ||= value.length > 4096;
      stderrTail = value.slice(-4096);
      const facts = guardianStderrFacts(stderrTail);
      journalExitUnconfirmed ||= facts.journalExitUnconfirmed; diagnosticCapped ||= facts.capped;
      for (const key of Object.keys(diagnosticSets)) for (const entry of facts[key]) {
        if (diagnosticSets[key].has(entry)) continue;
        if (diagnosticSets[key].size < 16) diagnosticSets[key].add(entry); else diagnosticCapped = true;
      }
    });
    clients.push(client);
    const start = transport.start.bind(transport);
    transport.start = async () => {
      await start();
      const pid = transport.pid;
      const scope = { roots: new Set([pid]), identities: new Map() }; scopes.push(scope);
      await ownedScopeDescendants([scope], { rememberLiveRoots: true });
      assert.equal(transport.pid, pid, 'Owned client exited during initial identity observation');
    };
    await client.connect(transport);
    return client;
  }
  async function call(client, name, args) {
    const reply = await client.callTool({ name, arguments: args }, undefined, { signal: t.signal });
    const value = JSON.parse(reply.content[0].text);
    assert.equal(JSON.stringify(value).includes('fake-jobs-key-canary'), false);
    return { ...value, isError: reply.isError === true };
  }
  try {
    const client = await open();
    const discovery = await client.listTools();
    assert.deepEqual(discovery.tools.map(tool => tool.name).sort(), ['start_workflow', 'get_workflow_status', 'get_workflow_result', 'cancel_workflow', 'cleanup_workflows', 'list_workflows'].sort());
    const denied = await call(client, 'start_workflow', { requestKey: 'denied', workflow: { steps: [{ type: 'click', selector: 'button' }] } });
    assert.equal(denied.isError, true);
    assert.deepEqual((await call(client, 'list_workflows', {})).jobs, []);
    const workflow = { timeoutMs: 15000, steps: [{ type: 'goto', url: origin }, { type: 'waitFor', selector: '#never' }] };
    const [first, duplicate] = await Promise.all([call(client, 'start_workflow', { requestKey: 'fake-jobs-key-canary', workflow }), call(client, 'start_workflow', { requestKey: 'fake-jobs-key-canary', workflow })]);
    assert.equal(first.isError, false); assert.equal(first.jobId, duplicate.jobId);
    const conflict = await call(client, 'start_workflow', { requestKey: 'fake-jobs-key-canary', workflow: { ...workflow, timeoutMs: 12000 } });
    assert.equal(conflict.code, 'idempotency_conflict');
    let row;
    const end = performance.now() + 10000;
    do { row = await call(client, 'get_workflow_status', { jobId: first.jobId }); if (row.completed === 1) break; await new Promise(resolve => setTimeout(resolve, 25)); } while (performance.now() < end);
    assert.equal(row.state, 'RUNNING');
    assert.equal((await call(client, 'cleanup_workflows', { jobIds: [first.jobId], dryRun: false })).results[0].code, 'not_terminal'); assert.equal(row.completed, 1);
    const foreign = await open(randomUUID());
    assert.equal((await call(foreign, 'get_workflow_status', { jobId: first.jobId })).code, 'not_found');
    const queued = await call(client, 'start_workflow', { requestKey: 'queued', workflow });
    const cancelled = await call(client, 'cancel_workflow', { jobId: queued.jobId });
    assert.equal(cancelled.state, 'CANCELLED'); assert.equal(cancelled.completed, 0);
    const emptyResult = await call(client, 'get_workflow_result', { jobId: queued.jobId });
    assert.equal(emptyResult.ready, true); assert.equal(emptyResult.result, null);
    await ownedScopeDescendants(scopes);
    await call(client, 'cancel_workflow', { jobId: first.jobId });
    const result = await call(client, 'get_workflow_result', { jobId: first.jobId, waitMs: 10000 });
    assert.equal(result.ready, true); assert.equal(result.job.state, 'CANCELLED');
    assert.equal(result.result.reportPath, undefined);
    assert.equal((await call(client, 'start_workflow', { requestKey: 'fake-jobs-key-canary', workflow })).jobId, first.jobId);
    assert.equal((await call(client, 'get_workflow_status', { jobId: first.jobId, ownerId: owner })).isError, true);
    await client.close();
    const restarted = await open();
    assert.equal((await call(restarted, 'get_workflow_status', { jobId: first.jobId })).state, 'CANCELLED');
    assert.equal((await call(restarted, 'start_workflow', { requestKey: 'fake-jobs-key-canary', workflow })).jobId, first.jobId);
    const eofJob = await call(restarted, 'start_workflow', { requestKey: 'eof', workflow });
    const eofEnd = performance.now() + 10000;
    do { row = await call(restarted, 'get_workflow_status', { jobId: eofJob.jobId }); if (row.completed === 1) break; await new Promise(resolve => setTimeout(resolve, 25)); } while (performance.now() < eofEnd);
    assert.equal(row.state, 'RUNNING');
    await ownedScopeDescendants(scopes);
    await restarted.close();
    const observer = await open();
    const eofResult = await call(observer, 'get_workflow_result', { jobId: eofJob.jobId, waitMs: 10000 });
    assert.equal(eofResult.ready, true); assert.equal(eofResult.job.state, 'CANCELLED');
    assert.equal(eofResult.job.operatorAttentionRequired, false);
    const writer = await open(owner, true);
    const startedAt = performance.now();
    const large = await call(writer, 'start_workflow', { requestKey: '1000-actions', workflow: { timeoutMs: 120000, steps: [
      { type: 'goto', url: origin }, { type: 'click', selector: { role: 'button', name: 'Add' }, repeat: 997 },
      { type: 'assertText', selector: 'output', equals: '997' }, { type: 'assertURL', url: origin + '/' },
    ] } });
    assert.equal(large.isError, false); assert.ok(performance.now() - startedAt < 5000, 'Start occupied the long execution');
    let largeResult; const largeEnd = performance.now() + 130000;
    do { largeResult = await call(writer, 'get_workflow_result', { jobId: large.jobId, waitMs: 10000 }); } while (!largeResult.ready && performance.now() < largeEnd);
    assert.equal(largeResult.job.state, 'SUCCEEDED', JSON.stringify(largeResult));
    assert.equal(largeResult.result.completed, 1000);
    assert.equal(largeResult.result.recentSteps.length, 10);
    assert.equal(largeResult.result.reportPath, undefined);
    const preview = await call(writer, 'cleanup_workflows', { jobIds: [large.jobId] });
    assert.equal(preview.results[0].ok, true); assert.equal(preview.results[0].dryRun, true); assert.ok(preview.results[0].files >= 1);
    const cleaned = await call(writer, 'cleanup_workflows', { jobIds: [large.jobId], dryRun: false });
    assert.equal(cleaned.results[0].removed, true);
    assert.equal((await call(writer, 'cleanup_workflows', { jobIds: [large.jobId], dryRun: false })).results[0].alreadyAbsent, true);
    assert.equal((await call(foreign, 'cleanup_workflows', { jobIds: [large.jobId], dryRun: false })).results[0].code, 'not_found');
    assert.equal((await call(writer, 'start_workflow', { requestKey: '1000-actions', workflow: { timeoutMs: 120000, steps: [
      { type: 'goto', url: origin }, { type: 'click', selector: { role: 'button', name: 'Add' }, repeat: 997 },
      { type: 'assertText', selector: 'output', equals: '997' }, { type: 'assertURL', url: origin + '/' },
    ] } })).jobId, large.jobId);
    assert.equal((await call(writer, 'get_workflow_result', { jobId: large.jobId })).result.completed, 1000);
    const captureClient = await open(owner, false, 1);
    const captureWorkflow = { timeoutMs: 20000, steps: [{ type: 'goto', url: origin }, { type: 'screenshot' }] };
    const override = await call(captureClient, 'start_workflow', { requestKey: 'quota-override', workflow: captureWorkflow, maxScreenshotBytes: 268435456 });
    assert.equal(override.isError, true);
    const capture = await call(captureClient, 'start_workflow', { requestKey: 'quota', workflow: captureWorkflow });
    let captureResult; const captureEnd = performance.now() + 25000;
    do { captureResult = await call(captureClient, 'get_workflow_result', { jobId: capture.jobId, waitMs: 10000 }); } while (!captureResult.ready && performance.now() < captureEnd);
    assert.equal(captureResult.job.state, 'FAILED'); assert.equal(captureResult.result.completed, 1);
    assert.equal(captureResult.result.failedStep.failureKind, 'artifact_quota');
    assert.equal(captureResult.result.reportPath, undefined); assert.equal(JSON.stringify(captureResult).includes(root), false);
    const captureConfig = await resolveJobConfig({ env: { PLAYWRIGHT_JOBS_OWNER_ID: owner, PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'data'), PLAYWRIGHT_JOBS_PROJECT_DIR: root } });
    const captureFiles = await readdir(path.join(captureConfig.execution.artifactsDir, 'exec-' + captureResult.result.runId), { recursive: true });
    assert.equal(captureFiles.some(name => name.endsWith('.png') || path.basename(name).startsWith('.capture-')), false);
    assert.ok((await call(captureClient, 'cleanup_workflows', { jobIds: [capture.jobId] })).results[0].files >= 1, 'Safe report and cleanup metadata remain available');
    verified = true;
  } catch (error) {
    primaryFailure = error;
    console.error(JSON.stringify({ fixture: 'jobs_mcp_failure', diagnosticCoverage: 'bounded_stderr_tail',
      ...Object.fromEntries(Object.entries(diagnosticSets).map(([key, values]) => [key, [...values]])),
      journalExitUnconfirmed, stderrTailTruncated, diagnosticCapped }));
    throw error;
  }
  finally {
    const closed = await Promise.allSettled(clients.map(client => client.close()));
    const closeFailures = closed.filter(result => result.status === 'rejected').map(result => result.reason);
    let clean = false; let auditFailure;
    try {
      const end = performance.now() + 10000;
      while ((await ownedScopeDescendants(scopes)).length && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 50));
      assert.deepEqual(await ownedScopeDescendants(scopes), []);
      clean = true;
    } catch (error) { auditFailure = error; }
    finally {
      server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
      if (verified && clean && !closeFailures.length) await rm(root, { recursive: true, force: true });
      else console.error(JSON.stringify({ fixture: 'jobs_mcp_workspace_preserved', verified,
        primaryFailed: !!primaryFailure, aborted: t.signal.aborted, auditConfirmed: clean,
        auditFailed: !!auditFailure, closeFailures: closeFailures.length }));
    }
    const failures = [...closeFailures, ...(auditFailure ? [auditFailure] : [])];
    if (failures.length) throw new AggregateError([...(primaryFailure ? [primaryFailure] : []), ...failures],
      'Jobs MCP acceptance, client close or ownership audit failed', { cause: primaryFailure ?? failures[0] });
  }
});

if (!supportsJournal) test('preview endpoint rejects unsupported runtime before creating state', { timeout: 10000 }, async context => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jobs-unsupported-'));
  let child;
  try {
    child = spawn(process.execPath, [entry], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env,
      PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'data') } });
    context.signal.addEventListener('abort', () => child.kill('SIGKILL'), { once: true });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    const [code] = await once(child, 'close');
    assert.equal(code, 1); assert.equal(stdout, '');
    assert.ok(stderr.includes('unsupported_runtime'));
    assert.deepEqual(await readdir(root), []);
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await once(child, 'close'); }
    await rm(root, { recursive: true, force: true });
  }
});

if (supportsJournal) test('preview stdio jobs: bounded result wait calls preserve cancellation capacity', { timeout: 30000 }, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jobs-wait-cap-'));
  const env = { ...process.env, PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(),
    PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'data'), PLAYWRIGHT_JOBS_PROJECT_DIR: root };
  let journal; let client; let verified = false; let cancelTimer;
  try {
    const config = await resolveJobConfig({ env }); journal = await JobJournal.open(config.journal);
    // Synthetic queued metadata only. No controller owns workflow input, so no
    // browser is allocated; the actual SDK, endpoint and SQLite still execute.
    const id = randomUUID();
    await journal.call('create', { id, requestKey: 'wait-cap', workflowDigest: 'a'.repeat(64), total: 1, deadlineAt: Date.now() + 60000 });
    client = new Client({ name: 'jobs-wait-cap', version: '1' });
    const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env, stderr: 'pipe' });
    transport.stderr.resume();
    await client.connect(transport);
    const call = async (name, args) => {
      const reply = await client.callTool({ name, arguments: args }, undefined, { signal: t.signal });
      return { ...JSON.parse(reply.content[0].text), isError: reply.isError === true };
    };
    const waiting = Array.from({ length: 5 }, () => call('get_workflow_result', { jobId: id, waitMs: 2000 }));
    // Cancellation remains a separate operation even when all wait slots fill.
    const cancelled = new Promise((resolve, reject) => { cancelTimer = setTimeout(() => {
      call('cancel_workflow', { jobId: id }).then(resolve, reject);
    }, 50); });
    const [results, cancellation] = await Promise.all([Promise.all(waiting), cancelled]);
    assert.equal(cancellation.state, 'CANCELLED');
    assert.equal(results.filter(result => result.code === 'controller_busy' && result.isError).length, 1);
    assert.equal(results.filter(result => result.ready && result.job.state === 'CANCELLED' && !result.isError).length, 4);
    const fresh = await Promise.all(Array.from({ length: 4 }, () => call('get_workflow_result', { jobId: id, waitMs: 1000 })));
    assert.ok(fresh.every(result => result.ready && !result.isError), 'Settled waits release their slots');
    const missing = await Promise.all(Array.from({ length: 4 }, () => call('get_workflow_result', { jobId: randomUUID(), waitMs: 1000 })));
    assert.ok(missing.every(result => result.code === 'not_found' && result.isError));
    const afterFailure = await Promise.all(Array.from({ length: 4 }, () => call('get_workflow_result', { jobId: id, waitMs: 1000 })));
    assert.ok(afterFailure.every(result => result.ready && !result.isError), 'Failed lookups release their wait slots');
    assert.equal((await call('list_workflows', {})).jobs.length, 1);
    verified = true;
  } catch (error) {
    t.diagnostic(JSON.stringify({ phase: 'jobs_wait_cap', ...guardianDiagnostic(error, 'unknown', error?.command) }));
    throw error;
  } finally {
    clearTimeout(cancelTimer); await client?.close(); await journal?.close();
    if (verified) await rm(root, { recursive: true, force: true });
    else console.error('Jobs wait-cap fixture preserved: acceptance not confirmed');
  }
});
