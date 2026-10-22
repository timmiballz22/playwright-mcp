// Internal controller acceptance against source or an independently installed tarball.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
const target = path.resolve(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url)));
const { supportsJournal } = await import(pathToFileURL(path.join(target, 'local-batch/jobs/journal.mjs')));
if (!supportsJournal) {
  console.log(JSON.stringify({ component: 'internal_job_controller', supported: false, requiredNode: '22.13+' }));
} else {
  const { JobController } = await import(pathToFileURL(path.join(target, 'local-batch/jobs/controller.mjs')));
  const { ownedDescendants } = await import(pathToFileURL(path.join(target, 'local-batch/fixtures/process-audit.mjs')));
  const root = await mkdtemp(path.join(os.tmpdir(), 'production-controller-'));
  let pages = 0; let controller; let safeToRemove = false; let verified = false; let primaryFailure;
  const roots = [];
  const server = createServer((request, response) => {
    if (request.url !== '/') { response.writeHead(204); response.end(); return; }
    pages++;
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<button>Add</button><output>0</output><input value="fake-controller-secret-canary"><script>let n=0;document.querySelector("button").onclick=()=>document.querySelector("output").textContent=String(++n)</script>');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const config = { journal: { directory: path.join(root, 'journal'), projectId: 'f'.repeat(64), ownerId: 'production-controller' },
    execution: { allowedOrigins: [origin], artifactsDir: path.join(root, 'artifacts') },
    onEvent: event => { if (event.pid) roots.push(event.pid); } };
  const workflow = { timeoutMs: 15000, steps: [{ type: 'goto', url: origin + '/' },
    { type: 'click', selector: { role: 'button', name: 'Add' }, repeat: 3 }, { type: 'assertText', selector: 'output', equals: '3' }] };
  try {
    controller = await JobController.open(config); roots.push(controller.journal.child.pid);
    const [first, duplicate] = await Promise.all([controller.start(workflow, 'first'), controller.start(workflow, 'first')]);
    assert.equal(first.jobId, duplicate.jobId);
    const second = await controller.start(workflow, 'second');
    for (const job of [first, second]) {
      const deadline = performance.now() + 20000;
      let row;
      do {
        row = await controller.status(job.jobId);
        if (row.state === 'SUCCEEDED') break;
        if (['FAILED', 'CANCELLED', 'CRASHED', 'TIMED_OUT'].includes(row.state)) {
          const failed = await controller.result(job.jobId);
          assert.fail(JSON.stringify({ fixture: 'production_controller_failure', state: row.state,
            reason: failed.reason ?? row.reason, stage: failed.stage ?? null, completed: failed.completed,
            operatorAttentionRequired: row.operatorAttentionRequired,
            cleanup: failed.execution?.cleanup ?? null, tempCleanup: failed.execution?.tempCleanup ?? null }));
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      } while (performance.now() < deadline);
      assert.equal(row.state, 'SUCCEEDED'); assert.equal(row.completed, 5);
      const result = await controller.result(job.jobId);
      assert.equal(result.ok, true); assert.equal(result.reportPath, undefined);
      assert.equal(JSON.stringify(result).includes('fake-controller-secret-canary'), false);
    }
    assert.equal(pages, 2);
    assert.equal((await controller.close()).cleanupConfirmed, true); controller = undefined;
    assert.deepEqual(await ownedDescendants(roots), []);
    controller = await JobController.open(config); roots.push(controller.journal.child.pid);
    assert.equal((await controller.start(workflow, 'first')).jobId, first.jobId);
    assert.equal((await controller.status(first.jobId)).state, 'SUCCEEDED');
    assert.equal((await controller.close()).cleanupConfirmed, true); controller = undefined;
    assert.equal(pages, 2, 'Reconnect replayed a finished workflow');
    assert.deepEqual(await ownedDescendants(roots), []); safeToRemove = true;
    console.log(JSON.stringify({ component: 'internal_job_controller', realBrowser: 'chromium', jobs: 2,
      completed: 10, duplicateExecuted: false, reconnectReplay: false, activeOwnedProcesses: 0, production: process.argv[2] !== undefined }));
    verified = true;
  } catch (error) {
    primaryFailure = error; throw error;
  } finally {
    let closeFailure;
    if (controller) {
      try { safeToRemove = (await controller.close()).cleanupConfirmed; }
      catch (error) { safeToRemove = false; closeFailure = error; }
    }
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    if (verified && safeToRemove && !(await ownedDescendants(roots)).length) await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    else console.error(JSON.stringify({ component: 'installed_controller_fixture_preserved', workspaceId: path.basename(root),
      verified, primaryFailed: !!primaryFailure, closeFailed: !!closeFailure, cleanupConfirmed: safeToRemove }));
    if (closeFailure) throw new AggregateError(primaryFailure ? [primaryFailure, closeFailure] : [closeFailure],
      'Installed controller fixture close failed', { cause: primaryFailure ?? closeFailure });
  }
}
