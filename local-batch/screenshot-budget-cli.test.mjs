import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { ownedDescendants } from './fixtures/process-audit.mjs';
test('CLI operator screenshot byte limit rejects capture with a safe summary and no published PNG', { timeout: 30000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'screenshot-cli-'));
  const fixture = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<title>Owned capture fixture</title>'); });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  let verified = false;
  try {
    const workflow = path.join(root, 'workflow.json');
    await writeFile(workflow, JSON.stringify({ timeoutMs: 10000, steps: [{ type: 'goto', url: origin }, { type: 'screenshot' }] }));
    let failure;
    try { await promisify(execFile)(process.execPath, [fileURLToPath(new URL('./cli.mjs', import.meta.url)), '--workflow', workflow, '--allow-origin', origin, '--allow-sensitive-artifacts', '--max-screenshot-bytes', '1', '--artifacts', path.join(root, 'output')], { timeout: 20000, maxBuffer: 262144 }); }
    catch (error) { failure = error; }
    assert.equal(failure?.code, 1);
    const result = JSON.parse(failure.stdout);
    assert.equal(result.completed, 1); assert.equal(result.failedStep.failureKind, 'artifact_quota');
    assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
    const names = await readdir(root, { recursive: true });
    assert.equal(names.some(name => name.endsWith('.png') || path.basename(name).startsWith('.capture-')), false);
    assert.deepEqual(await ownedDescendants([result.execution.supervisorPid, result.execution.workerPid, ...result.execution.browserPids]), []);
    verified = true;
  } finally {
    fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
    if (verified) await rm(root, { recursive: true, force: true });
  }
});
