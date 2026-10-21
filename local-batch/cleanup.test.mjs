import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, realpath, mkdir, stat, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cleanupTemporaryDirectory } from './cleanup.mjs';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { ownedDescendants } from './fixtures/process-audit.mjs';

test('temporary cleanup completes in a separate process and reports a startup deadline', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cleanup-process-'));
  const dir = path.join(root, 'tmp');
  try {
    await mkdir(dir); await writeFile(path.join(dir, 'profile'), 'fixture');
    assert.equal(await cleanupTemporaryDirectory(dir), true);
    await assert.rejects(stat(dir), { code: 'ENOENT' });
    await mkdir(dir); await writeFile(path.join(dir, 'profile'), 'fixture');
    const start = performance.now();
    assert.equal(await cleanupTemporaryDirectory(dir, 1), false);
    assert.ok(performance.now() - start < 3000);
    // This ordinary deadline control preserves its directory. A false return
    // generally retains uncertainty rather than certifying helper termination.
    assert.equal((await stat(dir)).isDirectory(), true);
  } finally { await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});


async function bounded(promise, timeoutMs) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Cleanup owner fixture deadline')), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
test('actual temporary cleanup worker exits on parent death while filesystem awaits', { timeout: 30000 }, async () => {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'temp-cleanup-owner-')));
  const directory = path.join(base, 'tmp'); await mkdir(directory, { mode: 0o700 });
  const marker = path.join(base, 'pending'); const wrapper = path.join(base, 'pending-worker.mjs'); const parentModule = path.join(base, 'owner.mjs');
  let parent; let exited; let verified = false;
  try {
    // Real worker IPC/EOF handler; only its private rm boundary is suspended.
    await writeFile(wrapper, `import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
fs.rm = async () => { await fs.writeFile(${JSON.stringify(marker + '.tmp')}, 'pending'); await fs.rename(${JSON.stringify(marker + '.tmp')}, ${JSON.stringify(marker)}); await new Promise(() => {}); };
syncBuiltinESMExports(); await import(${JSON.stringify(new URL('./cleanup-worker.mjs', import.meta.url).href)});`);
    // Separate owner avoids letting a slow read-only audit turn EOF into the
    // adapter's timeout. No browser or descendant process is fabricated.
    await writeFile(parentModule, `import { fork } from 'node:child_process';
const child = fork(${JSON.stringify(wrapper)}, [], {stdio:['ignore','ignore','ignore','ipc'],execArgv:[],windowsHide:true});
child.once('spawn', () => process.send({pid:child.pid})); child.send({directory:${JSON.stringify(directory)}});`);
    parent = fork(parentModule, [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: [], windowsHide: true });
    exited = once(parent, 'exit');
    const [message] = await bounded(Promise.race([once(parent, 'message'), exited.then(() => { throw new Error('Cleanup owner exited before readiness'); })]), 2000);
    assert.ok(Number.isSafeInteger(message.pid) && message.pid > 1);
    const pendingBy = performance.now() + 2000;
    for (;;) {
      try { assert.equal(await readFile(marker, 'utf8'), 'pending'); break; }
      catch (error) { if (error.code !== 'ENOENT' || performance.now() >= pendingBy) throw error; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const observed = await ownedDescendants([parent.pid, message.pid], { rememberLiveRoots: true });
    assert.ok(observed.includes(message.pid), 'Observe the actual pending worker before owner death');
    parent.kill('SIGKILL'); await bounded(exited, 1000);
    let survivors; const stoppedBy = performance.now() + 2000;
    do { survivors = await ownedDescendants(observed); if (!survivors.length) break; await new Promise(resolve => setTimeout(resolve, 25)); } while (performance.now() < stoppedBy);
    assert.deepEqual(survivors, []); assert.equal((await stat(directory)).isDirectory(), true); verified = true;
  } finally {
    if (parent && parent.exitCode === null && parent.signalCode === null) {
      parent.kill('SIGKILL'); await bounded(exited, 1000).catch(() => {});
      if (parent.exitCode === null && parent.signalCode === null) { if (parent.connected) parent.disconnect(); parent.unref(); }
    }
    if (verified) await rm(base, { recursive: true, force: true });
    else console.error('Temporary cleanup owner fixture preserved: ' + base);
  }
});
