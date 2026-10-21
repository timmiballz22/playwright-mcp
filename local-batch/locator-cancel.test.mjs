import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';

test('cancellation during a witnessed real locator wait confirms progress and owned cleanup', { timeout: 40000 }, async () => {
  const fixture = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<!doctype html><h1>Owned locator fixture</h1>'); });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const root = await mkdtemp(path.join(os.tmpdir(), 'locator-cancel-'));
  const abort = new AbortController(); const owned = []; let pending; let verified = false;
  try {
    pending = executeWorkflow({ timeoutMs: 30000, actionTimeoutMs: 30000, steps: [
      { type: 'goto', url: origin }, { type: 'waitFor', selector: '#never-present' },
    ] }, { artifactsDir: root, allowedOrigins: [origin], signal: abort.signal,
      workerModule: new URL('./fixtures/locator-wait-phase.mjs', import.meta.url),
      onEvent: event => { if (event.pid) owned.push(event.pid); },
    });
    const phaseDeadline = performance.now() + 12000; let phase;
    while (!phase && performance.now() < phaseDeadline) {
      phase = (await readdir(root, { recursive: true })).find(name => name.endsWith('locator-phase-fixture.json'));
      if (!phase) await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.ok(phase, 'Real locator wait must start before cancellation');
    assert.deepEqual(JSON.parse(await readFile(path.join(root, phase), 'utf8')), { pending: true });
    const observed = await ownedDescendants(owned, { rememberLiveRoots: true });
    assert.ok(observed.length > 0);
    const start = performance.now(); abort.abort(); const result = await pending;
    assert.equal(result.ok, false); assert.equal(result.reason, 'cancelled'); assert.equal(result.completed, 1);
    assert.equal(result.retrySafe, false); assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
    assert.ok(performance.now() - start < 8000, 'Cancellation cleanup must return within its bounded window');
    assert.deepEqual(await ownedDescendants([...owned, ...observed]), []); verified = true;
  } finally {
    abort.abort(); if (pending) await pending;
    fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
    if (verified) await rm(root, { recursive: true, force: true });
  }
});
