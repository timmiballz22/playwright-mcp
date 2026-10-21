import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readdir, rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { executeWorkflow } from './executor.mjs';
import { randomUUID } from 'node:crypto';
import { JobController } from './jobs/controller.mjs';
import { supportsJournal } from './jobs/journal.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';

for (const [label, worker] of [['partial write', './fixtures/report-error-worker.mjs'], ['byte ceiling', './jobs/fixtures/report-byte-limit.mjs']]) {
test(label + ': report failure preserves completed actions and publishes no corrupt JSON', { timeout: 15000 }, async () => {
  let navigations = 0; let effects = 0; let verified = false;
  const fixture = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/effect') { effects++; res.end('ack'); return; }
    if (req.url === '/') navigations++;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<button onclick="fetch('/effect',{method:'POST'}).then(()=>document.querySelector('output').id='done')">Ready</button><output>Waiting</output>`);
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const dir = await mkdtemp(path.join(os.tmpdir(), 'report-failure-'));
  try {
    const result = await executeWorkflow({ steps: [{ type: 'goto', url: origin }, { type: 'click', selector: 'button' }, { type: 'waitFor', selector: '#done' }, { type: 'waitFor', selector: 'button', repeat: 2 }] }, {
      artifactsDir: dir, allowedOrigins: [origin], workerModule: new URL(worker, import.meta.url),
    });
    assert.equal(result.ok, false);
    assert.equal(result.stage, 'report'); assert.equal(result.reason, 'execution_failed');
    assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
    assert.equal(result.completed, 5, 'Already executed actions must not be reported as unstarted');
    assert.equal(result.reportPath, null);
    assert.equal(result.retrySafe, false);
    assert.equal(result.completionCertainty, 'confirmed_lower_bound');
    assert.equal(navigations, 1, 'Reporting failure replayed an already executed navigation');
    assert.equal(effects, 1, 'Reporting failure replayed an already executed POST');
    assert.equal(JSON.stringify(result).includes('fake-report-secret'), false, 'Report exception leaked sensitive diagnostic text');
    const files = await readdir(path.join(dir, 'exec-' + result.runId));
    assert.equal(files.some(file => /^\.?run-[0-9a-f-]+\.(json|tmp)$/.test(file)), false, 'A partial report was published or retained');
    verified = true;
  } finally {
    fixture.closeAllConnections(); fixture.close();
    if (verified) await rm(dir, { recursive: true, force: true });
    else console.error('Report fault fixture preserved: ' + dir);
  }
});

}


if (supportsJournal) test('durable report byte failure retains progress and deduplicates an already executed POST', { timeout: 30000 }, async () => {
  let effects = 0; let navigations = 0; let controller; let verified = false; const owned = [];
  const fixture = createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/effect') { effects++; response.end('ack'); return; }
    if (request.url === '/') navigations++; response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(`<button onclick="fetch('/effect',{method:'POST'}).then(()=>document.querySelector('output').id='done')">Apply</button><output>Waiting</output>`);
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const root = await mkdtemp(path.join(os.tmpdir(), 'report-quota-job-'));
  try {
    controller = await JobController.open({ journal: { directory: path.join(root, 'journal'), projectId: 'd'.repeat(64), ownerId: randomUUID() },
      execution: { artifactsDir: path.join(root, 'artifacts'), allowedOrigins: [origin], workerModule: new URL('./jobs/fixtures/report-byte-limit.mjs', import.meta.url).href },
      onEvent: event => { if (event.pid) owned.push(event.pid); } });
    const workflow = { timeoutMs: 10000, steps: [{ type: 'goto', url: origin }, { type: 'click', selector: 'button' }, { type: 'waitFor', selector: '#done' }] };
    const first = await controller.start(workflow, 'report-byte-limit');
    let row; const end = performance.now() + 10000;
    do { row = await controller.status(first.jobId); if (['FAILED', 'SUCCEEDED', 'CRASHED', 'CANCELLED', 'TIMED_OUT'].includes(row.state)) break;
      await new Promise(resolve => setTimeout(resolve, 25)); } while (performance.now() < end);
    assert.equal(row.state, 'FAILED'); assert.equal(row.completed, 3); assert.equal(row.operatorAttentionRequired, false);
    const result = await controller.result(first.jobId);
    assert.equal(result.stage, 'report'); assert.equal(result.reason, 'execution_failed'); assert.equal(result.retrySafe, false);
    assert.equal(JSON.stringify(result).includes('fake-report-secret'), false);
    assert.equal((await controller.start(workflow, 'report-byte-limit')).jobId, first.jobId);
    assert.equal(effects, 1); assert.equal(navigations, 1);
    assert.equal((await controller.close()).cleanupConfirmed, true); controller = undefined;
    assert.deepEqual(await ownedDescendants(owned), []);
    verified = true;
  } finally {
    await controller?.close(); fixture.closeAllConnections(); fixture.close();
    if (verified) await rm(root, { recursive: true, force: true });
    else console.error('Report quota job fixture preserved: acceptance not confirmed');
  }
});

// Requires the browser-installed suite, not the builtin-only component matrix.
{
const reserve = 8388608 + 16384;
async function quotaFixture(body) {
  const base = await mkdtemp(path.join(os.tmpdir(), 'retained-budget-browser-'));
  try { await body(base); } finally { await rm(base, { recursive: true, force: true }); }
}
if (supportsJournal) test('durable quota failure remains deduplicated and a later admitted job executes', { timeout: 30000 }, async () => quotaFixture(async base => {
  const artifactsDir = path.join(base, 'artifacts'); await mkdir(artifactsDir, { mode: 0o700 });
  const marker = path.join(artifactsDir, 'prior'); await writeFile(marker, 'prior');
  const owned = [];
  const controller = await JobController.open({ onEvent: event => { if (event.pid) owned.push(event.pid); }, journal: { directory: path.join(base, 'journal'), ownerId: randomUUID(), projectId: 'a'.repeat(64) },
    execution: { artifactsDir, maxScreenshotBytes: 0, maxRetainedArtifactBytes: reserve + 4 } });
  const workflow = { steps: [{ type: 'waitFor', selector: 'body' }] }; const key = randomUUID();
  try {
    const started = await controller.start(workflow, key);
    const wait = async id => {
      for (let i = 0; i < 200; i++) { const row = await controller.status(id); if (['FAILED', 'SUCCEEDED'].includes(row.state)) return row; await new Promise(r => setTimeout(r, 25)); }
      assert.fail('Terminal job receipt missing');
    };
    const failed = await wait(started.jobId); assert.equal(failed.state, 'FAILED'); assert.equal(failed.completed, 0); assert.equal(failed.operatorAttentionRequired, false);
    assert.equal((await controller.start(workflow, key)).jobId, started.jobId);
    await rm(marker); // Explicit fixture-owner deletion; admission never prunes.
    const next = await controller.start(workflow, randomUUID()); assert.equal((await wait(next.jobId)).state, 'SUCCEEDED');
  } finally { await controller.close(); assert.deepEqual(await ownedDescendants(owned), []); }
}));

}
