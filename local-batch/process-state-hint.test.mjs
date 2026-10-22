import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportedProcessStateHint } from './fixtures/process-state-hint.mjs';
import * as hints from './fixtures/process-state-hint.mjs';
test('group hint retains members after reported leader disappears without declaring ownership', async () => {
  const result = await hints.reportedProcessGroupHint([10, 20], { platform: 'darwin', effectiveUid: 50,
    query: async () => '0 0 0 R\n11 10 50 S\n12 10 0 Z\n99 99 50 t\n' });
  assert.deepEqual(result, { coverage: 'reported_group_ids_only', identityVerified: false, groups: [
    { reportedGroup: 10, leaderPresent: false, members: 2, nonZombie: 1, zombie: 1, sameEffectiveUid: 1, differentEffectiveUid: 1 },
    { reportedGroup: 20, leaderPresent: false, members: 0, nonZombie: 0, zombie: 0, sameEffectiveUid: 0, differentEffectiveUid: 0 },
  ] });
});
test('group hint bounds and rejects raw diagnostics without leaking or signaling', async () => {
  const tooManyRows = Array.from({ length: 16385 }, (_, index) => `${index + 1} 10 50 S\n`).join('');
  for (const [output, expectedReason] of [['fake-private-group-canary', 'row_format'], ['11 10 50 S\n11 20 50 Z\n', 'duplicate_pid'],
    ['x'.repeat(1048577), 'output_limit'], ['€'.repeat(400000), 'output_limit'], [tooManyRows, 'row_limit']]) {
    let reason;
    assert.deepEqual(await hints.reportedProcessGroupHint([10], { platform: 'darwin', effectiveUid: 50, query: async () => output,
      onSnapshotFailure: value => { reason = value; } }), { coverage: 'invalid_snapshot' });
    assert.equal(reason, expectedReason);
  }
  assert.deepEqual(await hints.reportedProcessGroupHint([10], { platform: 'darwin', effectiveUid: 50, query: async () => { throw new Error('fake-private-group-canary'); } }), { coverage: 'unavailable' });
  assert.deepEqual(await hints.reportedProcessGroupHint([0], { platform: 'darwin' }), { coverage: 'invalid_metadata' });
  assert.deepEqual(await hints.reportedProcessGroupHint(Array.from({ length: 17 }, (_, index) => index + 10), { platform: 'darwin', effectiveUid: 50 }), { coverage: 'invalid_metadata' });
  assert.deepEqual(await hints.reportedProcessGroupHint([10], { platform: 'win32', query: async () => { throw new Error('must not query'); } }), { coverage: 'not_collected' });
});
test('failure process hint distinguishes reported state counts without leaking diagnostic text or granting identity', async () => {
  assert.deepEqual(await reportedProcessStateHint([10, 20, 30], { platform: 'darwin', query: async () => '10 Z\n20 S+\n' }), { coverage: 'reported_pids_only', nonZombie: 1, zombie: 1, missing: 1, identityVerified: false });
  for (const output of ['fake-private-diagnostic-canary', '10 S\n10 Z\n', '99 S\n', 'x'.repeat(4097)]) {
    assert.deepEqual(await reportedProcessStateHint([10], { platform: 'darwin', query: async () => output }), { coverage: 'invalid_snapshot' });
  }
  assert.deepEqual(await reportedProcessStateHint([10], { platform: 'darwin', query: async () => { throw new Error('fake-private-diagnostic-canary'); } }), { coverage: 'unavailable' });
  assert.deepEqual(await reportedProcessStateHint(['fake-private-diagnostic-canary'], { platform: 'darwin' }), { coverage: 'invalid_metadata' });
});
if (['linux', 'darwin'].includes(process.platform)) test('read-only process hint observes this live test process', async () => {
  assert.deepEqual(await reportedProcessStateHint([process.pid]), { coverage: 'reported_pids_only', nonZombie: 1, zombie: 0, missing: 0, identityVerified: false });
});

if (['linux', 'darwin'].includes(process.platform)) test('group hint observes a real member after its actual factory leader exits', { timeout: 15000 }, async () => {
  const { spawn } = await import('node:child_process'); const { once } = await import('node:events');
  const { mkdtemp, readFile, writeFile, rm } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url'); const path = await import('node:path'); const os = await import('node:os');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'group-hint-orphan-'));
  const program = `const {spawn}=require('node:child_process'),{readFile}=require('node:fs/promises'),path=require('node:path');
    const child=spawn(process.execPath,[process.argv[1],process.argv[2]],{stdio:'ignore'});child.on('error',()=>process.exit(1));child.unref();
    (async()=>{for(;;){try{if(/^\\d+$/.test(await readFile(path.join(process.argv[2],'child-ready'),'utf8')))process.exit(0);}catch{}await new Promise(r=>setTimeout(r,20));}})();`;
  const parent = spawn(process.execPath, ['-e', program, fileURLToPath(new URL('./jobs/fixtures/unreported-child.mjs', import.meta.url)), directory], { detached: true, stdio: 'ignore' });
  const exited = once(parent, 'close'); const errors = []; const failureFacts = [];
  let timer, orphanPid, factoryExitCode = null, leaderHint, groupHint, selfExitHint;
  let invalidSnapshotReason = null;
  let gone = false, removalAttempted = false, primaryPhase = 'factory_exit', cleanupPhase = 'not_started';
  const failureFact = (error, phase) => ({ phase,
    kind: ['AssertionError', 'Error', 'AggregateError', 'TypeError', 'RangeError'].includes(error?.name) ? error.name : 'other',
    code: ['ERR_ASSERTION', 'ENOENT', 'EACCES', 'EPERM', 'ENOMEM', 'EAGAIN', 'ETIMEDOUT'].includes(error?.code) ? error.code : 'unclassified',
    ...(typeof error?.actual === 'number' || typeof error?.actual === 'boolean' ? { actual: error.actual } : {}),
    ...(typeof error?.expected === 'number' || typeof error?.expected === 'boolean' ? { expected: error.expected } : {}) });
  try {
    const [code] = await Promise.race([exited, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Factory leader did not exit')), 5000); })]);
    factoryExitCode = code; clearTimeout(timer); assert.equal(code, 0);
    primaryPhase = 'child_ready';
    orphanPid = Number(await readFile(path.join(directory, 'child-ready'), 'utf8')); assert.ok(Number.isSafeInteger(orphanPid) && orphanPid > 1);
    primaryPhase = 'leader_hint';
    leaderHint = await reportedProcessStateHint([parent.pid]);
    assert.equal(leaderHint.missing, 1);
    primaryPhase = 'group_hint';
    const result = groupHint = await hints.reportedProcessGroupHint([parent.pid], { onSnapshotFailure: reason => { invalidSnapshotReason = reason; } });
    assert.equal(result.coverage, 'reported_group_ids_only'); assert.equal(result.identityVerified, false);
    assert.equal(result.groups[0].leaderPresent, false); assert.equal(result.groups[0].nonZombie, 1);
    assert.equal(result.groups[0].sameEffectiveUid, 1); assert.equal(result.groups[0].differentEffectiveUid, 0);
  } catch (error) { errors.push(error); failureFacts.push(failureFact(error, primaryPhase)); }
  finally {
    clearTimeout(timer);
    try {
      // Private self-exit request only; the observed orphan PID grants no signal authority.
      cleanupPhase = 'self_exit_request';
      await writeFile(path.join(directory, 'stop-child'), '', { mode: 0o600 });
      cleanupPhase = 'factory_close';
      if (parent.exitCode === null && parent.signalCode === null) { parent.kill('SIGKILL'); await exited; }
      cleanupPhase = 'child_ready';
      orphanPid ??= Number(await readFile(path.join(directory, 'child-ready'), 'utf8'));
      cleanupPhase = 'self_exit_wait';
      const end = performance.now() + 8000;
      do {
        const hint = selfExitHint = await reportedProcessStateHint([orphanPid]);
        gone = hint.coverage === 'reported_pids_only' && hint.nonZombie === 0;
        if (gone) break;
        await new Promise(resolve => setTimeout(resolve, 20));
      } while (performance.now() < end);
      assert.ok(gone, 'Controlled group member self-exit must be confirmed');
      cleanupPhase = 'fixture_remove';
      if (!errors.length) { removalAttempted = true; await rm(directory, { recursive: true, force: true }); }
    } catch (error) { errors.push(error); failureFacts.push(failureFact(error, cleanupPhase)); }
  }
  if (errors.length) {
    console.error(JSON.stringify({ fixture: 'group_hint_control_failure', workspace: path.basename(directory),
      factoryExitCode, primaryPhase, cleanupPhase, removalAttempted, selfExitConfirmed: gone, invalidSnapshotReason,
      leaderHint: leaderHint ?? null, groupHint: groupHint ?? null, selfExitHint: selfExitHint ?? null, failureFacts }));
    throw new AggregateError(errors, 'Group hint fixture verification or cleanup failed');
  }
});
