import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';

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
    assert.equal(result.ok, false); assert.equal(result.reason, 'worker_crashed'); assert.equal(result.completed, 0);
    assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
    assert.deepEqual(await readdir(temporaryBase), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
