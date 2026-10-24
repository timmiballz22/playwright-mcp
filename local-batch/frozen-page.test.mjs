import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';

test('a real page main-thread freeze cannot defeat the independent execution deadline', { timeout: 30000 }, async () => {
  let entered = 0;
  const fixture = createServer((request, response) => {
    if (request.url === '/freeze-entered') { entered++; response.end('go'); return; }
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(`<!doctype html><title>Owned freeze fixture</title><script>
      setTimeout(async()=>{await fetch('/freeze-entered');while(true){}},100);
    </script>`);
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const root = await mkdtemp(path.join(os.tmpdir(), 'frozen-page-'));
  const owned = []; let verified = false;
  try {
    const start = performance.now();
    const result = await executeWorkflow({ timeoutMs: 10000, actionTimeoutMs: 15000, steps: [
      { type: 'goto', url: origin }, { type: 'waitFor', selector: '#never-present' },
    ] }, { artifactsDir: root, allowedOrigins: [origin], onEvent: event => { if (event.pid) owned.push(event.pid); } });
    const elapsed = performance.now() - start;
    // Failure-only fixed execution facts. Preserve the original assertions and
    // deadlines; missing cleanup diagnostics must not hide behind a reason mismatch.
    const diagnostic = JSON.stringify({ fixture: 'frozen_page_execution', entered,
      elapsedMs: Math.round(elapsed), ok: result.ok, reason: result.reason,
      completed: result.completed, execution: result.execution });
    assert.equal(entered, 1, 'Browser must reach the freeze trigger, not merely fail launch; ' + diagnostic);
    assert.equal(result.ok, false, diagnostic); assert.equal(result.reason, 'timeout', diagnostic); assert.equal(result.completed, 1, diagnostic);
    assert.ok(elapsed < 12000, 'Independent10s boundary must return within bounded scheduling slack; ' + diagnostic);
    assert.equal(result.execution.cleanup, 'terminated', diagnostic); assert.equal(result.execution.tempCleanup, 'removed', diagnostic);
    assert.deepEqual(await ownedDescendants(owned), []); verified = true;
  } finally {
    fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
    if (verified) await rm(root, { recursive: true, force: true });
  }
});
