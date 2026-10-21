// Exercise the preview adapter from an independently installed production tarball.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const target = path.resolve(process.argv[2]);
const { supportsJournal } = await import(pathToFileURL(path.join(target, 'local-batch/jobs/journal.mjs')));
if (!supportsJournal || process.platform === 'win32') {
  console.log(JSON.stringify({ entry: 'local-batch/jobs-mcp.mjs', supported: false, reason: supportsJournal ? 'private_acl_unverified' : 'requires_node_22_13' }));
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
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(target, 'local-batch/jobs-mcp.mjs')], stderr: 'pipe', env: {
    ...process.env, PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'data'), PLAYWRIGHT_JOBS_PROJECT_DIR: root,
    PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: origin, PLAYWRIGHT_JOBS_ALLOW_MUTATIONS: '0', PLAYWRIGHT_JOBS_ALLOW_SENSITIVE_ARTIFACTS: '0',
  } });
  const call = async (name, args) => {
    const response = await client.callTool({ name, arguments: args });
    assert.notEqual(response.isError, true, 'Production jobs tool failed'); return JSON.parse(response.content[0].text);
  };
  try {
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 5);
    const input = { requestKey: 'production-key', workflow: { steps: [{ type: 'goto', url: origin }, { type: 'assertText', selector: '#ready', equals: 'ready' }] } };
    const first = await call('start_workflow', input);
    assert.equal((await call('start_workflow', input)).jobId, first.jobId);
    const result = await call('get_workflow_result', { jobId: first.jobId, waitMs: 10000 });
    assert.equal(result.ready, true); assert.equal(result.job.state, 'SUCCEEDED');
    assert.equal(result.result.completed, 2); assert.equal(result.result.reportPath, undefined);
    assert.equal(navigations, 1);
    console.log(JSON.stringify({ entry: 'local-batch/jobs-mcp.mjs', handshake: true, toolCount: 5, realBrowser: 'chromium', completed: 2, duplicateExecuted: false, production: true }));
  } finally {
    let clean = false;
    try {
      const observed = await ownedDescendants([transport.pid]);
      await client.close();
      const end = performance.now() + 10000;
      while ((await ownedDescendants(observed)).length && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 50));
      assert.deepEqual(await ownedDescendants(observed), []);
      clean = true;
    } finally {
      await client.close().catch(() => {});
      server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
      if (clean) await rm(root, { recursive: true, force: true });
    }
  }
}
