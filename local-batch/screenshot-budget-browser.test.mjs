import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, stat, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';
test('real screenshot byte budget keeps first PNG and rejects the next before publication, with verified owned cleanup', { timeout: 30000 }, async () => {
  const fixture = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<style>body{background:rgb(30,80,140)}</style>'); });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const root = await mkdtemp(path.join(os.tmpdir(), 'screenshot-byte-fixture-')); const owned = []; let verified = false;
  const options = { allowedOrigins: [origin], artifactsDir: root, allowSensitiveArtifacts: true, onEvent: event => { if (event.pid) owned.push(event.pid); } };
  try {
    const control = await executeWorkflow({ timeoutMs: 10000, steps: [{ type: 'goto', url: origin }, { type: 'screenshot' }] }, options);
    assert.equal(control.ok, true);
    const firstBytes = (await stat(control.recentSteps.at(-1).artifact)).size;
    assert.ok(firstBytes > 0);
    const result = await executeWorkflow({ timeoutMs: 10000, steps: [{ type: 'goto', url: origin }, { type: 'screenshot' }, { type: 'screenshot' }] }, { ...options, maxScreenshotBytes: Math.floor(firstBytes * 1.5) });
    assert.equal(result.ok, false); assert.equal(result.completed, 2); assert.equal(result.total, 3);
    assert.equal(result.reason, 'action_failed'); assert.equal(result.failedStep.failureKind, 'artifact_quota');
    assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
    const image = result.recentSteps.find(step => step.type === 'screenshot' && step.ok).artifact;
    assert.equal((await readFile(image)).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const names = await readdir(path.dirname(image)); assert.deepEqual(names, ['step-0002.png']);
    if (process.platform !== 'win32') assert.equal((await stat(image)).mode & 0o777, 0o600);
    assert.deepEqual(await ownedDescendants(owned), []); verified = true;
  } finally {
    fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
    if (verified) await rm(root, { recursive: true, force: true });
  }
});
