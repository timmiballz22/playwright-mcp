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
import { supportsJournal } from './jobs/journal.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';
const entry = fileURLToPath(new URL('./jobs-mcp.mjs', import.meta.url));
if (supportsJournal && process.platform !== 'win32') test('preview stdio jobs: durable IDs, duplicate admission, isolation, cancellation and reconnect', { timeout: 180000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jobs-mcp-'));
  const owner = randomUUID(); const clients = []; const roots = []; let observed = [];
  const server = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<div id="ready">ready</div><button>Add</button><output>0</output><script>let n=0;document.querySelector("button").onclick=()=>document.querySelector("output").textContent=String(++n)</script>'); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function open(ownerId = owner, mutations = false) {
    const client = new Client({ name: 'jobs-acceptance', version: '1.0.0' });
    const transport = new StdioClientTransport({ command: process.execPath, args: [entry], stderr: 'pipe', env: {
      ...process.env, PLAYWRIGHT_JOBS_ALLOW_MUTATIONS: mutations ? '1' : '0', PLAYWRIGHT_JOBS_ALLOW_SENSITIVE_ARTIFACTS: '0', PLAYWRIGHT_JOBS_OWNER_ID: ownerId, PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'data'), PLAYWRIGHT_JOBS_PROJECT_DIR: root, PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: origin,
    } });
    await client.connect(transport); roots.push(transport.pid); clients.push(client); return client;
  }
  async function call(client, name, args) {
    const reply = await client.callTool({ name, arguments: args });
    const value = JSON.parse(reply.content[0].text);
    assert.equal(JSON.stringify(value).includes('fake-jobs-key-canary'), false);
    return { ...value, isError: reply.isError === true };
  }
  try {
    const client = await open();
    const discovery = await client.listTools();
    assert.deepEqual(discovery.tools.map(tool => tool.name).sort(), ['start_workflow', 'get_workflow_status', 'get_workflow_result', 'cancel_workflow', 'list_workflows'].sort());
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
    assert.equal(row.state, 'RUNNING'); assert.equal(row.completed, 1);
    const foreign = await open(randomUUID());
    assert.equal((await call(foreign, 'get_workflow_status', { jobId: first.jobId })).code, 'not_found');
    const queued = await call(client, 'start_workflow', { requestKey: 'queued', workflow });
    const cancelled = await call(client, 'cancel_workflow', { jobId: queued.jobId });
    assert.equal(cancelled.state, 'CANCELLED'); assert.equal(cancelled.completed, 0);
    const emptyResult = await call(client, 'get_workflow_result', { jobId: queued.jobId });
    assert.equal(emptyResult.ready, true); assert.equal(emptyResult.result, null);
    observed = await ownedDescendants(roots);
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
    observed.push(...await ownedDescendants(roots));
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
  } finally {
    await Promise.allSettled(clients.map(client => client.close()));
    let clean = false;
    try {
      const end = performance.now() + 10000;
      while ((await ownedDescendants([...roots, ...observed])).length && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 50));
      assert.deepEqual(await ownedDescendants([...roots, ...observed]), []);
      clean = true;
    } finally {
      server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
      if (clean) await rm(root, { recursive: true, force: true });
    }
  }
});

if (!supportsJournal || process.platform === 'win32') test('preview endpoint rejects unsupported runtime/private-storage platform before creating state', { timeout: 10000 }, async context => {
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
    assert.ok(stderr.includes(supportsJournal ? 'unsupported_private_storage' : 'unsupported_runtime'));
    assert.deepEqual(await readdir(root), []);
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await once(child, 'close'); }
    await rm(root, { recursive: true, force: true });
  }
});
