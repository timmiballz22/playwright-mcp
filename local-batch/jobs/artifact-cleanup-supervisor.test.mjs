import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { spawn, fork } from 'node:child_process';
import { ownedDescendants } from '../fixtures/process-audit.mjs';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { JobController } from './controller.mjs';
import { cleanupJobArtifactsBounded } from './artifact-cleanup-supervisor.mjs';

const receipt = { ok: true, result: { dryRun: true, files: 0, bytes: 0, removed: false, alreadyAbsent: true } };
test('bounded artifact worker previews, removes and preserves fixed safe errors', async () => {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'bounded-artifacts-')));
  const runId = randomUUID(); const root = path.join(base, 'exec-' + runId);
  try {
    await mkdir(root, { mode: 0o700 }); await writeFile(path.join(root, 'marker'), 'private', { mode: 0o600 });
    assert.deepEqual(await cleanupJobArtifactsBounded({ base, runId }), { dryRun: true, files: 1, bytes: 7, removed: false, alreadyAbsent: false });
    assert.equal(await readFile(path.join(root, 'marker'), 'utf8'), 'private');
    assert.equal((await cleanupJobArtifactsBounded({ base, runId, dryRun: false })).removed, true);
    assert.equal((await cleanupJobArtifactsBounded({ base, runId })).alreadyAbsent, true);
    await assert.rejects(cleanupJobArtifactsBounded({ base, runId: 'private-canary' }), error => error.code === 'invalid_metadata' && !String(error).includes('private-canary'));
  } finally { await rm(base, { recursive: true, force: true }); }
});

for (const mode of ['before-result', 'after-result', 'invalid-result', 'failed-result', 'signal-exit']) {
  test(`artifact worker ${mode}: independent deadline and natural-exit confirmation`, { timeout: 10000 }, async () => {
    const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'artifact-worker-fault-')));
    const workerModule = path.join(base, 'fault.mjs');
    const programs = {
      'before-result': "process.once('message', () => { while (true) {} });",
      'after-result': `process.once('message', () => process.send(${JSON.stringify(receipt)}, () => { while (true) {} }));`,
      'invalid-result': "process.once('message', () => process.send({ok:true,result:{private:'private-canary'}}, () => { while (true) {} }));",
      'failed-result': "process.once('message', () => process.send({ok:false,code:'unsafe_artifacts'}, () => process.exit(1)));",
      'signal-exit': `process.once('message', () => process.send(${JSON.stringify(receipt)}, () => process.kill(process.pid, 'SIGKILL')));`,
    };
    let owned; let exited = false; let received = false;
    const sibling = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    await once(sibling, 'spawn');
    try {
      await writeFile(workerModule, programs[mode]);
      const expected = mode === 'failed-result' ? 'unsafe_artifacts' : mode === 'invalid-result' || mode === 'signal-exit' ? 'cleanup_failed' : 'cleanup_timeout';
      await assert.rejects(cleanupJobArtifactsBounded({ base, runId: randomUUID() }, { workerModule, timeoutMs: 750, killGraceMs: 1000,
        onEvent(event) { if (event.type === 'spawned') owned = event.pid; if (event.type === 'exited') exited = true; if (event.type === 'resultReceived') received = true; } }),
      error => error.code === expected && error.message === expected);
      assert.ok(owned); assert.equal(exited, true, 'Failure receipt must follow confirmed owned-child exit');
      if (mode === 'after-result') assert.equal(received, true, 'A positive receipt alone must never become cleanup success');
      assert.equal(sibling.exitCode, null); assert.equal(sibling.signalCode, null);
    } finally {
      const stopped = once(sibling, 'exit'); sibling.kill('SIGKILL'); await stopped;
      await rm(base, { recursive: true, force: true });
    }
  });
}

test('an unconfirmed cleanup blocks further scopes in the same controller', async () => {
  let queried = false;
  const controller = new JobController({ call() { queried = true; throw new Error('private-canary'); } }, {}, {});
  const queued = controller.cleanup(randomUUID());
  controller.cleanupUnconfirmed = true;
  await assert.rejects(queued, { code: 'cleanup_unconfirmed' });
  await assert.rejects(controller.cleanup(randomUUID()), { code: 'cleanup_unconfirmed' });
  assert.equal(queried, false);
});


test('actual artifact worker exits after controller death while filesystem awaits', { timeout: 30000 }, async () => {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'artifact-parent-death-')));
  const marker = path.join(base, 'pending');
  const wrapper = path.join(base, 'blocked-worker.mjs');
  const parentModule = path.join(base, 'controller.mjs');
  const actualWorker = new URL('./artifact-cleanup-worker.mjs', import.meta.url).href;
  let parent; let observed = []; let verified = false; let primary;
  const phases = { bootstrap: false, runtime_imported: false, filesystem_entered: false, marker_written: false };
  let workerExited = false; let workerExitCode = null; let workerExitSignal = null; let workerResponse = false;
  try {
    // Patch only this private worker's lstat. The real runtime worker, scope
    // validation and IPC-disconnect handler still run, with an unresolved async
    // filesystem boundary rather than a fabricated success/error receipt.
    await writeFile(wrapper, `import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
process.send({fixturePhase:'bootstrap'});
fs.lstat = async () => { process.send({fixturePhase:'filesystem_entered'}); await fs.writeFile(${JSON.stringify(marker + '.tmp')}, 'pending'); await fs.rename(${JSON.stringify(marker + '.tmp')}, ${JSON.stringify(marker)}); process.send({fixturePhase:'marker_written'}); return await new Promise(() => {}); };
syncBuiltinESMExports();
await import(${JSON.stringify(actualWorker)});
process.send({fixturePhase:'runtime_imported'});`);
    // A private surrogate parent isolates EOF handling from the adapter's
    // already-tested five-second timeout. Slow read-only native audits must not
    // accidentally turn this into a timeout test instead of parent death.
    await writeFile(parentModule, `import { fork } from 'node:child_process';
const child = fork(${JSON.stringify(wrapper)}, [], {stdio:['ignore','ignore','ignore','ipc'],execArgv:[],windowsHide:true});
child.once('spawn', () => process.send({pid:child.pid}));
child.on('message', packet => {
  if (['bootstrap','runtime_imported','filesystem_entered','marker_written'].includes(packet?.fixturePhase)) process.send({fixturePhase:packet.fixturePhase});
  else if (typeof packet?.ok === 'boolean') process.send({workerResponse:true});
});
child.once('exit', (code, signal) => { if (process.connected) process.send({workerExited:true,code,signal}); });
child.send(${JSON.stringify({ base, runId: randomUUID() })});`);
    parent = fork(parentModule, [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: [], windowsHide: true });
    parent.on('message', packet => {
      if (Object.hasOwn(phases, packet?.fixturePhase)) phases[packet.fixturePhase] = true;
      if (packet?.workerResponse === true) workerResponse = true;
      if (packet?.workerExited === true) {
        workerExited = true;
        workerExitCode = Number.isSafeInteger(packet.code) ? packet.code : null;
        workerExitSignal = ['SIGKILL','SIGTERM','SIGABRT'].includes(packet.signal) ? packet.signal : packet.signal ? 'other' : null;
      }
    });
    const [message] = await once(parent, 'message');
    assert.ok(Number.isSafeInteger(message.pid) && message.pid > 1);
    const pendingBy = performance.now() + 2000;
    for (;;) {
      try { assert.equal(await readFile(marker, 'utf8'), 'pending'); break; }
      catch (error) { if (error.code !== 'ENOENT' || performance.now() >= pendingBy) throw error; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    observed = await ownedDescendants([parent.pid, message.pid], { rememberLiveRoots: true });
    assert.ok(observed.includes(message.pid), 'Independently observe the actual pending worker before parent death');
    const exited = once(parent, 'exit'); parent.kill('SIGKILL'); await exited;
    const stoppedBy = performance.now() + 2000;
    let survivors;
    do {
      survivors = await ownedDescendants(observed);
      if (!survivors.length) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    } while (performance.now() < stoppedBy);
    assert.deepEqual(survivors, [], 'Disconnected artifact worker must exit despite pending filesystem promise');
    verified = true;
  } catch (error) { primary = error; throw error; }
  finally {
    if (parent && parent.exitCode === null && parent.signalCode === null) {
      const exited = once(parent, 'exit'); parent.kill('SIGKILL'); await exited;
    }
    if (verified) await rm(base, { recursive: true, force: true });
    else {
      const receipt = { fixture: 'artifact_parent_death_phase', ...phases, workerExited,
        workerExitCode, workerExitSignal, workerResponse, observedBeforeParentDeath: observed.length > 0,
        parentExited: parent ? parent.exitCode !== null || parent.signalCode !== null : false };
      const encoded = JSON.stringify(receipt);
      assert.ok(Buffer.byteLength(encoded) <= 1024, 'Artifact phase receipt byte bound exceeded');
      console.error(encoded);
      try { await writeFile(path.join(base, 'phase-failure.json'), encoded, { flag: 'wx', mode: 0o600 }); }
      catch (error) { if (primary) throw new AggregateError([primary, error], 'Artifact fixture and phase receipt failed'); throw error; }
      console.error('Artifact parent-death fixture preserved: shutdown not confirmed');
    }
  }
});
