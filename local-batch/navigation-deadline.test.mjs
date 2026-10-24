import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';

test('witnessed stalled navigation reaches workflow deadline without executing the next step', { timeout: 30000 }, async () => {
  let requests = 0; let laterRequests = 0; let witness;
  const arrived = new Promise(resolve => { witness = resolve; });
  const fixture = createServer((request, response) => {
    if (request.url === '/hang') { requests++; witness(); return; }
    laterRequests++; response.end('unexpected later step');
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const directory = await mkdtemp(path.join(os.tmpdir(), 'navigation-deadline-'));
  const owned = []; let pending; let settledAt; let verified = false; let timer;
  try {
    const start = performance.now();
    pending = executeWorkflow({ timeoutMs: 10000, steps: [
      { type: 'goto', url: origin + '/hang' }, { type: 'goto', url: origin + '/later' },
    ] }, { artifactsDir: directory, allowedOrigins: [origin],
      onEvent: event => { if (event.pid) owned.push(event.pid); },
    }).then(result => { settledAt = performance.now(); return result; });
    await Promise.race([arrived, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Navigation never reached owned fixture')), 12000); })]);
    clearTimeout(timer);
    const observed = await ownedDescendants(owned, { rememberLiveRoots: true });
    assert.ok(observed.length > 0, 'Expected live owned browser during pending navigation');
    const result = await pending;
    assert.equal(result.ok, false); assert.equal(result.reason, 'timeout');
    assert.equal(result.completed, 0); assert.equal(result.retrySafe, false);
    assert.equal(requests, 1, 'Navigation must not be retried'); assert.equal(laterRequests, 0);
    assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
    assert.ok(settledAt - start < 18000, 'Navigation deadline plus cleanup exceeded bounded window');
    assert.deepEqual(await ownedDescendants([...owned, ...observed]), []);
    verified = true;
  } finally {
    clearTimeout(timer);
    if (pending) await pending.catch(() => {});
    fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
    if (verified) await rm(directory, { recursive: true, force: true });
  }
});
