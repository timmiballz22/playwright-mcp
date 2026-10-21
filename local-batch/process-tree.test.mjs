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
