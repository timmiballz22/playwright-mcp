import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { resolveJobConfig } from './jobs/config.mjs';
import { supportsJournal } from './jobs/journal.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';

if (supportsJournal) test('two public owners queue screenshots and cleanup cannot delete the other owner artifact', { timeout: 90000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'jobs-screenshot-owners-'));
  const clients = []; const roots = []; let observed = []; let verified = false;
  const fixture = createServer((request, response) => {
    const alpha = request.url === '/alpha';
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(`<body style="background:${alpha ? 'red' : 'blue'}"><output>${alpha ? 'alpha' : 'beta'}</output>`);
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  async function open() {
    const env = { ...process.env, PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_DATA_DIR: path.join(directory, 'state'), PLAYWRIGHT_JOBS_PROJECT_DIR: directory, PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: origin, PLAYWRIGHT_JOBS_ALLOW_MUTATIONS: '0', PLAYWRIGHT_JOBS_ALLOW_SENSITIVE_ARTIFACTS: '1' };
    const config = await resolveJobConfig({ env });
    const client = new Client({ name: 'owned-screenshot-fixture', version: '1.0.0' }); clients.push(client);
    const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('./jobs-mcp.mjs', import.meta.url))], stderr: 'pipe', env });
    const start = transport.start.bind(transport);
    transport.start = async () => { await start(); roots.push(transport.pid); observed.push(...await ownedDescendants([transport.pid], { rememberLiveRoots: true })); };
    transport.stderr.resume(); await client.connect(transport);
    return { client, config };
  }
  async function call(owner, name, args) {
    const result = await owner.client.callTool({ name, arguments: args });
    const value = JSON.parse(result.content[0].text);
    return { ...value, isError: result.isError === true };
  }
  async function finish(owner, jobId) {
    const end = performance.now() + 60000; let value;
    do { value = await call(owner, 'get_workflow_result', { jobId, waitMs: 10000 }); } while (!value.ready && performance.now() < end);
    assert.equal(value.job?.state, 'SUCCEEDED', JSON.stringify(value));
    assert.equal(value.result.completed, 3); assert.equal(value.result.reportPath, undefined);
    return value.result;
  }
  try {
    const alpha = await open(); const beta = await open();
    assert.equal(alpha.config.journal.projectId, beta.config.journal.projectId);
    assert.notEqual(alpha.config.execution.artifactsDir, beta.config.execution.artifactsDir);
    const workflow = label => ({ timeoutMs: 60000, steps: [{ type: 'goto', url: origin + '/' + label }, { type: 'assertText', selector: 'output', equals: label }, { type: 'screenshot' }] });
    const [a, b] = await Promise.all([call(alpha, 'start_workflow', { requestKey: 'alpha-screenshot', workflow: workflow('alpha') }), call(beta, 'start_workflow', { requestKey: 'beta-screenshot', workflow: workflow('beta') })]);
    assert.equal(a.isError, false); assert.equal(b.isError, false); assert.notEqual(a.jobId, b.jobId);
    const [ar, br] = await Promise.all([finish(alpha, a.jobId), finish(beta, b.jobId)]);
    assert.notEqual(ar.runId, br.runId);
    async function screenshot(owner, result) {
      const root = path.join(owner.config.execution.artifactsDir, 'exec-' + result.runId);
      const pngs = (await readdir(root, { recursive: true })).filter(name => name.endsWith('.png'));
      assert.equal(pngs.length, 1);
      const filename = path.join(root, pngs[0]); const bytes = await readFile(filename);
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      return { filename, digest: createHash('sha256').update(bytes).digest('hex') };
    }
    const ap = await screenshot(alpha, ar); const bp = await screenshot(beta, br);
    assert.notEqual(ap.digest, bp.digest, 'Different fixture colors must yield distinct actual screenshots');
    assert.equal((await call(alpha, 'get_workflow_status', { jobId: b.jobId })).code, 'not_found');
    assert.equal((await call(alpha, 'cleanup_workflows', { jobIds: [b.jobId], dryRun: false })).results[0].code, 'not_found');
    const removed = await call(alpha, 'cleanup_workflows', { jobIds: [a.jobId], dryRun: false });
    assert.equal(removed.results[0].removed, true);
    await assert.rejects(readFile(ap.filename), { code: 'ENOENT' });
    assert.equal(createHash('sha256').update(await readFile(bp.filename)).digest('hex'), bp.digest);
    assert.equal((await call(alpha, 'start_workflow', { requestKey: 'alpha-screenshot', workflow: workflow('alpha') })).jobId, a.jobId);
    assert.deepEqual((await call(beta, 'list_workflows', {})).jobs.map(job => job.jobId), [b.jobId]);
    assert.equal((await call(beta, 'cleanup_workflows', { jobIds: [b.jobId], dryRun: false })).results[0].removed, true);
    verified = true;
  } finally {
    observed.push(...await ownedDescendants(roots));
    await Promise.allSettled(clients.map(client => client.close()));
    const end = performance.now() + 15000;
    while ((await ownedDescendants([...roots, ...observed])).length && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 100));
    assert.deepEqual(await ownedDescendants([...roots, ...observed]), []);
    fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
    if (verified) await rm(directory, { recursive: true, force: true });
  }
});
