import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';

test('real browser crash during a pending screenshot cannot publish success or an image', { timeout: 30000 }, async () => {
  const fixture = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<!doctype html><h1>Owned crash fixture</h1>'); });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const root = await mkdtemp(path.join(os.tmpdir(), 'screenshot-crash-'));
  const owned = []; let verified = false;
  try {
    const result = await executeWorkflow({ timeoutMs: 20000, steps: [{ type: 'goto', url: origin }, { type: 'screenshot' }] }, {
      artifactsDir: root, allowedOrigins: [origin], allowSensitiveArtifacts: true,
      onEvent: event => { if (event.pid) owned.push(event.pid); },
      workerModule: new URL('./fixtures/screenshot-browser-crash.mjs', import.meta.url),
    });
    const entries = await readdir(root, { recursive: true });
    const receipt = entries.filter(name => name.endsWith('browser-crash-fixture.json'));
    assert.equal(receipt.length, 1, 'Actual in-flight crash evidence is required');
    assert.deepEqual(JSON.parse(await readFile(path.join(root, receipt[0]), 'utf8')), { pending: true, killed: true });
    assert.equal(result.ok, false); assert.equal(result.completed, 1);
    assert.equal(result.reason, 'action_failed'); assert.equal(result.failedStep.type, 'screenshot');
    assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
    assert.equal(entries.some(name => /(?:\.png$|(?:^|[\\/])\.capture-.*\.tmp$)/.test(name)), false, 'Crashed capture must not publish image data');
    assert.deepEqual(await ownedDescendants(owned), []); verified = true;
  } finally {
    fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
    if (verified) await rm(root, { recursive: true, force: true });
  }
});
