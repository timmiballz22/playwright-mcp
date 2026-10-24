import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { supportsJournal } from './jobs/journal.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';

if (supportsJournal) test('public jobs persist page-limit failure, never replay it and release only the verified clean lease', { timeout: 90000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'page-limit-jobs-'));
  const client = new Client({ name: 'page-limit-fixture', version: '1.0.0' }); const roots = []; const observed = [];
  let nextHits = 0; let popupHits = 0;
  const fixture = createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    if (request.url === '/next') { nextHits++; response.end('<output>next</output>'); }
    else if (request.url === '/popup') { popupHits++; response.end('owned popup'); }
    else response.end('<!doctype html><button onclick="window.open(\'/popup\')">Open</button>');
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('./jobs-mcp.mjs', import.meta.url))], stderr: 'pipe', env: {
    ...process.env, PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_PROJECT_DIR: directory, PLAYWRIGHT_JOBS_DATA_DIR: path.join(directory, 'data'),
    PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: origin, PLAYWRIGHT_JOBS_ALLOW_MUTATIONS: '1', PLAYWRIGHT_JOBS_MAX_PAGES: '1',
  } });
  const start = transport.start.bind(transport);
  transport.start = async () => { await start(); roots.push(transport.pid); observed.push(...await ownedDescendants(roots, { rememberLiveRoots: true })); };
  transport.stderr.resume();
  const call = async (name, args) => { const reply = await client.callTool({ name, arguments: args }); return { ...JSON.parse(reply.content[0].text), isError: reply.isError === true }; };
  const finish = async jobId => {
    const end = performance.now() + 40000; let value;
    do { value = await call('get_workflow_result', { jobId, waitMs: 10000 }); } while (!value.ready && performance.now() < end);
    assert.equal(value.ready, true, JSON.stringify(value)); return value;
  };
  try {
    await client.connect(transport);
    const workflow = { timeoutMs: 20000, steps: [{ type: 'goto', url: origin }, { type: 'click', selector: 'button' }, { type: 'waitFor', selector: '#never' }, { type: 'goto', url: origin + '/next' }] };
    assert.equal((await call('start_workflow', { requestKey: 'override', workflow: { ...workflow, maxPages: 32 } })).isError, true);
    assert.deepEqual((await call('list_workflows', {})).jobs, []);
    const first = await call('start_workflow', { requestKey: 'limited', workflow }); assert.equal(first.isError, false);
    const result = await finish(first.jobId);
    assert.equal(result.job.state, 'FAILED'); assert.equal(result.job.reason, 'resource_limit'); assert.equal(result.job.resultAvailable, true);
    assert.equal(result.job.operatorAttentionRequired, false); assert.equal(result.result.reason, 'resource_limit');
    assert.equal(result.result.retrySafe, false); assert.equal(result.result.actionsSucceeded, false);
    assert.equal(result.result.execution.cleanup, 'terminated'); assert.equal(result.result.execution.tempCleanup, 'removed');
    assert.equal(nextHits, 0); const before = popupHits;
    assert.equal((await call('start_workflow', { requestKey: 'limited', workflow })).jobId, first.jobId);
    assert.equal(popupHits, before); assert.equal(nextHits, 0);
    const next = await call('start_workflow', { requestKey: 'clean-next', workflow: { timeoutMs: 20000, steps: [{ type: 'goto', url: origin + '/next' }, { type: 'assertText', selector: 'output', equals: 'next' }] } });
    assert.equal(next.isError, false);
    assert.equal((await finish(next.jobId)).job.state, 'SUCCEEDED'); assert.equal(nextHits, 1);
  } finally {
    let clean = false;
    try {
      observed.push(...await ownedDescendants(roots, { rememberLiveRoots: true })); await client.close();
      const end = performance.now() + 10000;
      while ((await ownedDescendants([...roots, ...observed])).length && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 50));
      assert.deepEqual(await ownedDescendants([...roots, ...observed]), []); clean = true;
    } finally { fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve)); if (clean) await rm(directory, { recursive: true, force: true }); }
  }
});
