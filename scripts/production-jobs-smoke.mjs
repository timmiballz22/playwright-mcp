// Exercise the preview adapter from an independently installed production tarball.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const target = path.resolve(process.argv[2]);
const { supportsJournal } = await import(pathToFileURL(path.join(target, 'local-batch/jobs/journal.mjs')));
if (!supportsJournal) {
  console.log(JSON.stringify({ entry: 'local-batch/jobs-mcp.mjs', supported: false, reason: 'requires_node_22_13' }));
} else {
  const { ownedDescendants } = await import(pathToFileURL(path.join(target, 'local-batch/fixtures/process-audit.mjs')));
  const root = await mkdtemp(path.join(os.tmpdir(), 'production-jobs-'));
  let navigations = 0;
  const server = createServer((request, response) => {
    if (request.url === '/') navigations++;
    response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<div id="ready">ready</div>');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const client = new Client({ name: 'production-jobs', version: '1.0.0' });
  const env = {
    ...process.env, PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'data'), PLAYWRIGHT_JOBS_PROJECT_DIR: root,
    PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: origin, PLAYWRIGHT_JOBS_ALLOW_MUTATIONS: '0', PLAYWRIGHT_JOBS_ALLOW_SENSITIVE_ARTIFACTS: '0',
  };
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(target, 'local-batch/jobs-mcp.mjs')], stderr: 'pipe', env });
  const call = async (name, args) => {
    const response = await client.callTool({ name, arguments: args });
    assert.notEqual(response.isError, true, 'Production jobs tool failed'); return JSON.parse(response.content[0].text);
  };
  let cliFailed = false; let verified = false;
  try {
    await client.connect(transport);
    await ownedDescendants([transport.pid], { rememberLiveRoots: true });
    assert.equal((await client.listTools()).tools.length, 6);
    const input = { requestKey: 'production-key', workflow: { steps: [{ type: 'goto', url: origin }, { type: 'assertText', selector: '#ready', equals: 'ready' }] } };
    const first = await call('start_workflow', input);
    assert.equal((await call('start_workflow', input)).jobId, first.jobId);
    const result = await call('get_workflow_result', { jobId: first.jobId, waitMs: 10000 });
    const receipt = JSON.stringify({ phase: 'initial_job', ready: result.ready, state: result.job?.state, completed: result.result?.completed, reason: result.result?.reason, cleanup: result.result?.execution?.cleanup });
    assert.equal(result.ready, true, receipt); assert.equal(result.job.state, 'SUCCEEDED', receipt);
    assert.equal(result.result.completed, 2); assert.equal(result.result.reportPath, undefined);
    assert.equal(navigations, 1);
    const preview = await call('cleanup_workflows', { jobIds: [first.jobId] });
    assert.equal(preview.results[0].dryRun, true); assert.ok(preview.results[0].files >= 1);
    assert.equal((await call('cleanup_workflows', { jobIds: [first.jobId], dryRun: false })).results[0].removed, true);
    assert.equal((await call('start_workflow', input)).jobId, first.jobId);
    assert.equal(navigations, 1);
    const workflowFile = path.join(root, 'workflow.json');
    await writeFile(workflowFile, JSON.stringify(input.workflow), { mode: 0o600 });
    const cli = async args => {
      try {
        const { stdout } = await promisify(execFile)(process.execPath, [path.join(target, 'local-batch/jobs-cli.mjs'), ...args], { env, timeout: 20000, maxBuffer: 262144 });
        return stdout.trim().split('\n').map(line => JSON.parse(line));
      } catch (error) { cliFailed = true; throw error; }
    };
    const cliStart = await cli(['start', '--workflow', workflowFile, '--request-key', 'production-cli']);
    assert.equal(cliStart[0].event, 'accepted'); assert.equal(cliStart[1].job.state, 'SUCCEEDED');
    const cliId = cliStart[0].job.jobId;
    assert.equal((await cli(['start', '--workflow', workflowFile, '--request-key', 'production-cli']))[0].job.jobId, cliId);
    assert.equal((await cli(['status', '--job-id', cliId]))[0].state, 'SUCCEEDED');
    assert.equal((await cli(['result', '--job-id', cliId]))[0].result.completed, 2);
    assert.ok((await cli(['list', '--limit', '2']))[0].jobs.some(job => job.jobId === cliId));
    assert.equal((await cli(['cleanup', '--job-id', cliId]))[0].results[0].dryRun, true);
    assert.equal((await cli(['cleanup', '--job-id', cliId, '--delete']))[0].results[0].removed, true);
    assert.equal(navigations, 2);
    const cancelJob = await call('start_workflow', { requestKey: 'cli-cancel', workflow: { timeoutMs: 20000, steps: [{ type: 'goto', url: origin }, { type: 'waitFor', selector: '#not-present' }] } });
    const end = performance.now() + 10000; let running;
    do { running = await call('get_workflow_status', { jobId: cancelJob.jobId }); if (running.completed === 1) break; await new Promise(resolve => setTimeout(resolve, 25)); } while (performance.now() < end);
    assert.equal(running.state, 'RUNNING'); assert.equal(running.completed, 1);
    assert.equal((await cli(['cancel', '--job-id', cancelJob.jobId]))[0].cancelRequested, true);
    assert.equal((await call('get_workflow_result', { jobId: cancelJob.jobId, waitMs: 10000 })).job.state, 'CANCELLED');
    verified = true;
    console.log(JSON.stringify({ entry: 'local-batch/jobs-cli.mjs', production: true, realBrowser: 'chromium', completed: 2, duplicateExecuted: false, statusResultListCleanup: true, activeCancel: true }));
    console.log(JSON.stringify({ entry: 'local-batch/jobs-mcp.mjs', handshake: true, toolCount: 6, realBrowser: 'chromium', completed: 2, duplicateExecuted: false, production: true }));
  } finally {
    let clean = false;
    try {
      const observed = await ownedDescendants([transport.pid]);
      await client.close();
      const end = performance.now() + 10000;
      while ((await ownedDescendants(observed)).length && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 50));
      assert.deepEqual(await ownedDescendants(observed), []);
      clean = !cliFailed && verified;
    } finally {
      await client.close().catch(() => {});
      server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
      if (clean) await rm(root, { recursive: true, force: true });
    }
  }
}
