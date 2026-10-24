import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { terminateOwnedProcesses } from './process-tree.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';
test('invalid termination roots remain rejected and emit only a fixed diagnostic', async () => {
  const events = [];
  assert.equal(await terminateOwnedProcesses(process.pid, [], true, code => events.push(code)), false);
  assert.deepEqual(events, ['invalid_root']);
  assert.equal(await terminateOwnedProcesses(process.pid, [], true, () => { throw new Error('fake-private-callback-canary'); }), false);
});
test('diagnostic callback preserves bounded termination of an actually owned fork', { timeout: 10000 }, async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { detached: process.platform !== 'win32', stdio: 'ignore' });
  const exited = once(child, 'exit'); const events = [];
  try {
    await once(child, 'spawn');
    const observed = await ownedDescendants([child.pid], { rememberLiveRoots: true });
    assert.equal(await terminateOwnedProcesses(child.pid, [], true, code => events.push(code)), true);
    await exited;
    assert.deepEqual(events, []);
    assert.deepEqual(await ownedDescendants([child.pid, ...observed]), []);
  } finally { if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; } }
});

if (process.platform !== 'win32') for (const [errorCode, detail] of [['EPERM', 'signal_permission_denied'], ['EINVAL', 'signal_invalid_argument'], ['PRIVATE_CANARY', 'signal_unknown_error'], ['ESRCH', null]]) {
  test(`POSIX signal diagnostic retains fixed ${detail ?? 'already-gone'} result without raw errors`, async () => {
    const original = process.kill; const events = [];
    process.kill = (_pid, name) => { throw Object.assign(new Error('private-signal-error-canary'), { code: name === 0 ? 'ESRCH' : errorCode }); };
    try {
      const ok = await terminateOwnedProcesses(2147483646, [2147483647], false, code => events.push(code));
      assert.equal(ok, detail === null);
      assert.deepEqual(events, detail === null ? [] : [detail, 'browser_group_signal_failed']);
      assert.equal(JSON.stringify(events).includes('canary'), false);
    } finally { process.kill = original; }
  });
}

if (process.platform !== 'win32') for (const [stopCode, detail] of [['ESRCH', null], ['EPERM', 'signal_permission_denied'], ['EINVAL', 'signal_invalid_argument'], ['PRIVATE_CANARY', 'signal_unknown_error']]) test(`a root freeze ${stopCode === 'PRIVATE_CANARY' ? 'unknown error' : stopCode} cannot authorize a later group signal or certify cleanup`, async () => {
  const original = process.kill; const signals = []; const events = [];
  process.kill = (pid, name) => {
    signals.push({ pid, name });
    if (name === 'SIGSTOP' || name === 0) throw Object.assign(new Error('private-missing-root-canary'), { code: name === 0 ? 'ESRCH' : stopCode });
  };
  try {
    const ok = await terminateOwnedProcesses(2147483646, [], true, code => events.push(code));
    console.log(JSON.stringify({ fixture: 'worker_freeze_authority', stop: stopCode === 'PRIVATE_CANARY' ? 'unknown' : stopCode, cleaned: ok, groupSignals: signals.filter(call => call.pid < 0).length, failures: events }));
    assert.deepEqual(signals.filter(call => call.pid < 0), [], 'Missing root must not authorize a process-group signal');
    assert.equal(ok, false);
    assert.deepEqual(events, [...(detail ? [detail] : []), 'worker_stop_failed']);
    assert.equal(JSON.stringify(events).includes('canary'), false);
  } finally { process.kill = original; }
});
