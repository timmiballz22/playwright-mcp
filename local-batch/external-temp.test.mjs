import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';
import { ownedDescendants, ownedScopeDescendants } from './fixtures/process-audit.mjs';

test('real browser uses a short external private temporary root and cancellation removes it', { timeout: 35000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'external-temp-'));
  const temporaryBase = path.join(root, 'pool'); await mkdir(temporaryBase, { mode: 0o700 });
  const artifactsDir = path.join(root, 'a'.repeat(64), 'b'.repeat(64));
  const fixture = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<!doctype html><p>Owned external temp fixture</p>'); });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const abort = new AbortController(); const owned = []; let pending; let verified = false;
  let ready; const started = new Promise(resolve => { ready = resolve; });
  try {
    pending = executeWorkflow({ timeoutMs: 25000, actionTimeoutMs: 25000, steps: [{ type: 'goto', url: origin }, { type: 'waitFor', selector: '#never' }] }, {
      artifactsDir, temporaryBase, allowedOrigins: [origin], signal: abort.signal,
      onEvent: event => { if (event.pid) owned.push(event.pid); if (event.type === 'progress' && event.completed === 1) ready(); },
    });
    await Promise.race([started, pending.then(result => { throw new Error('Execution ended before the real browser reached its wait: ' + JSON.stringify(result)); })]);
    const entries = await readdir(temporaryBase); assert.equal(entries.length, 1);
    assert.match(entries[0], /^tmp-[0-9a-f-]{36}$/);
    assert.ok((await readdir(path.join(temporaryBase, entries[0]))).length > 0, 'Real browser must allocate temporary profile data here');
    const observed = await ownedDescendants(owned, { rememberLiveRoots: true });
    abort.abort(); const result = await pending;
    assert.equal(result.reason, 'cancelled'); assert.equal(result.completed, 1);
    assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
    assert.deepEqual(await readdir(temporaryBase), []);
    assert.deepEqual(await ownedDescendants([...owned, ...observed]), []); verified = true;
  } finally {
    abort.abort(); if (pending) await pending;
    fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
    if (verified) await rm(root, { recursive: true, force: true });
  }
});

test('unacknowledged external temporary collision is retained and cleanup fails closed', { timeout: 10000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'temp-collision-'));
  const temporaryBase = path.join(root, 'pool'); await mkdir(temporaryBase, { mode: 0o700 });
  try {
    const result = await executeWorkflow({ timeoutMs: 5000, steps: [{ type: 'waitFor', selector: '#never' }] }, {
      artifactsDir: path.join(root, 'artifacts'), temporaryBase,
      workerModule: new URL('./fixtures/external-temp-collision.mjs', import.meta.url),
    });
    assert.equal(result.ok, false); assert.equal(result.reason, 'cleanup_failed'); assert.equal(result.completed, 0);
    assert.equal(result.execution.tempCleanup, 'unknown'); assert.equal(result.execution.cleanup, 'failed');
    assert.equal(await readFile(path.join(temporaryBase, 'tmp-' + result.runId, 'existing-marker'), 'utf8'), 'preserve-owned-fixture');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('worker crash after temporary ownership ACK removes only its owned external directory', { timeout: 10000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'temp-owned-crash-'));
  const temporaryBase = path.join(root, 'pool'); await mkdir(temporaryBase, { mode: 0o700 });
  try {
    const result = await executeWorkflow({ timeoutMs: 5000, steps: [{ type: 'waitFor', selector: '#never' }] }, {
      artifactsDir: path.join(root, 'artifacts'), temporaryBase,
      workerModule: new URL('./fixtures/external-temp-crash.mjs', import.meta.url),
    });
    assert.equal(result.ok, false); assert.equal(result.reason, 'cleanup_failed'); assert.equal(result.completed, 0);
    assert.deepEqual(result.execution.terminationFailures, ['browser_ownership_unconfirmed']);
    assert.equal(result.retrySafe, false);
    assert.equal(result.execution.cleanup, 'failed'); assert.equal(result.execution.tempCleanup, 'removed');
    assert.deepEqual(await readdir(temporaryBase), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});


test('actual worker final report cannot clear ownership after a rejected launch allocates a detached child', { timeout: 30000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rejected-launch-'));
  const control = path.join(root, 'control'); await mkdir(control, { mode: 0o700 });
  const previous = process.env.PLAYWRIGHT_TEST_UNREPORTED_CONTROL;
  process.env.PLAYWRIGHT_TEST_UNREPORTED_CONTROL = control;
  const scope = { roots: new Set(), identities: new Map() }; let pending; let accepted = false; let primary;
  const readPid = async name => {
    const end = performance.now() + 5000;
    do {
      try { const pid = Number(await readFile(path.join(control, name), 'utf8')); if (Number.isSafeInteger(pid) && pid > 1) return pid; } catch {}
      await new Promise(resolve => setTimeout(resolve, 20));
    } while (performance.now() < end);
    assert.fail('Actual worker private launch receipt missing');
  };
  try {
    pending = executeWorkflow({ timeoutMs: 15000, steps: [{ type: 'waitFor', selector: '#never' }] }, {
      artifactsDir: path.join(root, 'artifacts'), workerModule: new URL('./jobs/fixtures/rejected-launch-worker.mjs', import.meta.url),
      onEvent: event => { if (event.pid) scope.roots.add(event.pid); },
    });
    await readPid('worker-ready'); const childPid = await readPid('child-ready');
    assert.ok((await ownedScopeDescendants([scope], { rememberLiveRoots: true })).includes(childPid));
    await writeFile(path.join(control, 'crash-worker'), '', { flag: 'wx', mode: 0o600 });
    const result = await pending;
    assert.ok((await ownedScopeDescendants([scope])).includes(childPid), 'Rejected launch child must still be alive');
    assert.equal(result.reason, 'cleanup_failed', JSON.stringify({ reason: result.reason, cleanup: result.execution.cleanup, completed: result.completed, terminationFailures: result.execution.terminationFailures ?? [] })); assert.equal(result.execution.cleanup, 'failed');
    assert.equal(result.completed, 0); assert.equal(result.retrySafe, false);
    assert.deepEqual(result.execution.terminationFailures, ['browser_ownership_unconfirmed']);
    const files = await readdir(path.join(root, 'artifacts'), { recursive: true });
    const workerReport = files.find(file => /run-[0-9a-f-]+\.json$/.test(file));
    assert.ok(workerReport, 'Actual worker must publish its final failure report');
    const report = JSON.parse(await readFile(path.join(root, 'artifacts', workerReport), 'utf8'));
    assert.equal(report.reportScope, 'worker_execution'); assert.equal(report.ok, false);
    assert.equal(report.results[0].type, 'setup');
    assert.equal(JSON.stringify(report).includes('canary'), false);
    accepted = true;
  } catch (error) { primary = error; throw error; }
  finally {
    try {
      await writeFile(path.join(control, 'stop-child'), '', { mode: 0o600 });
      if (pending) await Promise.allSettled([pending]);
      const end = performance.now() + 8000; let empty = false;
      do {
        if (!(await ownedScopeDescendants([scope])).length) { empty = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      } while (performance.now() < end);
      assert.equal(empty, true, 'Rejected-launch fixture must acknowledge self-exit');
      if (accepted) await rm(root, { recursive: true, force: true });
    } catch (error) { if (primary) throw new AggregateError([primary, error], 'Launch witness and teardown failed'); throw error; }
    finally { if (previous === undefined) delete process.env.PLAYWRIGHT_TEST_UNREPORTED_CONTROL; else process.env.PLAYWRIGHT_TEST_UNREPORTED_CONTROL = previous; }
  }
});
