import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportedProcessStateHint } from './fixtures/process-state-hint.mjs';
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
