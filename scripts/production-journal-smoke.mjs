import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';

const target = process.argv[2];
const { JobJournal, supportsJournal } = await import(pathToFileURL(path.join(target, 'local-batch/jobs/journal.mjs')).href);
if (supportsJournal) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'installed-journal-'));
  const clients = [];
  let fixture;
  let guardian;
  let guardianExit;
  let watchdog;
  try {
    const config = { directory, projectId: createHash('sha256').update('installed-fixture').digest('hex') };
    const owner = await JobJournal.open({ ...config, ownerId: 'installed-owner' }); clients.push(owner);
    const other = await JobJournal.open({ ...config, ownerId: 'other-owner' }); clients.push(other);
    const data = { id: randomUUID(), requestKey: 'installed-request', workflowDigest: 'a'.repeat(64), total: 1, deadlineAt: Date.now() + 30000 };
    const job = await owner.call('create', data);
    assert.equal((await owner.call('create', { ...data, id: randomUUID() })).jobId, job.jobId);
    await assert.rejects(other.call('read', { id: job.jobId }), { code: 'not_found' });
    assert.equal((await owner.call('cancel', { id: job.jobId })).state, 'CANCELLED');
    const active = await owner.call('create', { ...data, id: randomUUID(), requestKey: 'installed-result' });
    const nonce = randomUUID();
    assert.equal((await owner.call('reserve', { id: active.jobId, nonce })).acquired, true);
    await owner.call('activate', { id: active.jobId, nonce });
    const summary = { ok: true, completed: 1, total: 1, browser: 'chromium', completionCertainty: 'exact' };
    await owner.call('finish', { id: active.jobId, nonce, state: 'SUCCEEDED', completed: 1, cleanupOk: true, summary });
    assert.deepEqual(await owner.call('result', { id: active.jobId }), summary);
    await assert.rejects(other.call('result', { id: active.jobId }), { code: 'not_found' });
    const { captureWorkflow } = await import(pathToFileURL(path.join(target, 'local-batch/jobs/workflow-snapshot.mjs')).href);
    fixture = createServer((request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<button onclick="document.querySelector(\'output\').textContent=String(++window.n)">Add</button><output>0</output><script>window.n=0</script>');
    });
    fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const workflow = { timeoutMs: 20000, steps: [{ type: 'goto', url: origin },
      { type: 'click', selector: 'button', repeat: 5 }, { type: 'assertText', selector: 'output', equals: '5' }] };
    const durable = await owner.call('create', { ...data, id: randomUUID(), requestKey: 'installed-guardian',
      workflowDigest: captureWorkflow(workflow).digest, total: 7, deadlineAt: Date.now() + 25000 });
    const guardianNonce = randomUUID();
    assert.equal((await owner.call('reserve', { id: durable.jobId, nonce: guardianNonce })).acquired, true);
    guardian = fork(path.join(target, 'local-batch/jobs/guardian.mjs'), [], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'], detached: true, execArgv: ['--max-old-space-size=128'], windowsHide: true,
    });
    guardianExit = once(guardian, 'exit');
    watchdog = setTimeout(() => guardian.kill('SIGKILL'), 40000);
    guardian.send({ type: 'start', id: durable.jobId, nonce: guardianNonce,
      journal: { ...config, ownerId: 'installed-owner', instanceId: owner.instanceId }, workflow,
      execution: { allowedOrigins: [origin], artifactsDir: path.join(directory, 'artifacts') } });
    assert.equal((await guardianExit)[0], 0);
    const durableResult = await owner.call('result', { id: durable.jobId });
    assert.equal(durableResult.ok, true);
    assert.equal(durableResult.completed, 7);
    assert.equal(durableResult.reportPath, undefined);
    assert.match(durableResult.reportId, /^[0-9a-f-]{36}$/);
    const report = JSON.parse(await readFile(path.join(directory, 'artifacts', 'exec-' + durableResult.runId, 'run-' + durableResult.reportId + '.json'), 'utf8'));
    assert.equal(report.runId, durableResult.runId);
    assert.equal(report.results.length, 7);
    await assert.rejects(other.call('result', { id: durable.jobId }), { code: 'not_found' });
    process.stdout.write(JSON.stringify({ entry: 'local-batch/jobs/guardian.mjs', durableExecution: true, realBrowser: true, completed: 7, production: true }) + '\n');
    // Metadata regression only: no browser failure is manufactured here.
    const uncertainId = randomUUID(), uncertainNonce = randomUUID();
    await owner.call('create', { ...data, id: uncertainId, requestKey: 'installed-termination-metadata' });
    assert.equal((await owner.call('reserve', { id: uncertainId, nonce: uncertainNonce })).acquired, true);
    await owner.call('activate', { id: uncertainId, nonce: uncertainNonce });
    const uncertainSummary = { ok: false, reason: 'cleanup_failed', completed: 0, total: 1,
      execution: { mode: 'supervised', forced: true, cleanup: 'failed', tempCleanup: 'removed', terminationFailures: ['wait_timeout'] } };
    const uncertain = await owner.call('finish', { id: uncertainId, nonce: uncertainNonce, state: 'FAILED', completed: 0, cleanupOk: false, summary: uncertainSummary });
    assert.equal(uncertain.operatorAttentionRequired, true);
    assert.deepEqual(await owner.call('result', { id: uncertainId }), uncertainSummary);
    await assert.rejects(owner.call('create', { ...data, id: randomUUID(), requestKey: 'installed-blocked', requireCleanLease: true }), { code: 'cleanup_blocked' });
    assert.deepEqual(await owner.call('integrity'), { ok: true });
    process.stdout.write(JSON.stringify({ entry: 'local-batch/jobs/journal.mjs', storageKernel: true, ownerIsolation: true, terminationDiagnosticMetadata: true, production: true }) + '\n');
  } finally {
    clearTimeout(watchdog);
    if (guardian && guardian.exitCode === null && guardian.signalCode === null) { guardian.kill('SIGKILL'); if (guardianExit) await guardianExit; }
    fixture?.closeAllConnections(); fixture?.close();
    await Promise.allSettled(clients.map(client => client.close()));
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
