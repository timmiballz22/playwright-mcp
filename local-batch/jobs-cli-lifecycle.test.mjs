import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { supportsJournal } from './jobs/journal.mjs';
import { resolveJobConfig } from './jobs/config.mjs';
import { JobController } from './jobs/controller.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';
if (supportsJournal && process.platform !== 'win32') test('foreground jobs CLI SIGTERM persists cancellation and leaves no active owned processes', { timeout: 40000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jobs-cli-signal-'));
  const server = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<div>ready</div>'); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const env = { ...process.env, PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_PROJECT_DIR: root,
    PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'data'), PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: `http://127.0.0.1:${server.address().port}`,
    PLAYWRIGHT_JOBS_ALLOW_MUTATIONS: '0', PLAYWRIGHT_JOBS_ALLOW_SENSITIVE_ARTIFACTS: '0' };
  let child; let exited; let observer; let observed = []; let output = '';
  try {
    const workflowFile = path.join(root, 'workflow.json');
    await writeFile(workflowFile, JSON.stringify({ timeoutMs: 20000, actionTimeoutMs: 15000, steps: [{ type: 'goto', url: env.PLAYWRIGHT_JOBS_ALLOWED_ORIGINS }, { type: 'waitFor', selector: '#missing' }] }));
    child = spawn(process.execPath, [fileURLToPath(new URL('./jobs-cli.mjs', import.meta.url)), 'start', '--workflow', workflowFile, '--request-key', 'signal'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    exited = once(child, 'close');
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 131072) child.kill('SIGTERM'); });
    child.stderr.resume();
    const end = performance.now() + 10000;
    while (!output.includes('\n') && performance.now() < end && child.exitCode === null) await new Promise(resolve => setTimeout(resolve, 25));
    const accepted = JSON.parse(output.split('\n')[0]);
    assert.equal(accepted.event, 'accepted');
    observer = await JobController.open(await resolveJobConfig({ env }));
    let job;
    do { job = await observer.status(accepted.job.jobId); if (job.completed === 1) break; await new Promise(resolve => setTimeout(resolve, 25)); } while (performance.now() < end);
    assert.equal(job.state, 'RUNNING'); assert.equal(job.completed, 1);
    observed = await ownedDescendants([child.pid]);
    child.kill('SIGTERM');
    const [code, signal] = await exited;
    assert.equal(code, 1); assert.equal(signal, null);
    job = await observer.status(accepted.job.jobId);
    assert.equal(job.state, 'CANCELLED'); assert.equal(job.operatorAttentionRequired, false);
    assert.equal(job.completed, 1);
    assert.equal(JSON.parse(output.trim().split('\n').at(-1)).event, 'complete');
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await exited; }
    await observer?.close();
    let clean = false;
    try {
      const end = performance.now() + 10000;
      while ((await ownedDescendants([child?.pid, ...observed])).length && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 50));
      assert.deepEqual(await ownedDescendants([child?.pid, ...observed]), []); clean = true;
    } finally {
      server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
      if (clean) await rm(root, { recursive: true, force: true });
    }
  }
});
