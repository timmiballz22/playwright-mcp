import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { supportsJournal } from './journal.mjs';
if (supportsJournal) test('controller fixture failure before readiness preserves fixed cause without private stderr', { timeout: 20000 }, async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  let failure;
  try {
    await promisify(execFile)(process.execPath, ['scripts/verify-guardian-parent-death.mjs', root], {
      cwd: root, timeout: 18000, maxBuffer: 32768,
      env: { ...process.env, PLAYWRIGHT_TEST_GUARDIAN_START_FAILURE: '1' },
    });
  } catch (error) { failure = error; }
  assert.equal(failure?.code, 1);
  assert.match(failure.stderr, /fixture_exited_before_ready/);
  assert.match(failure.stderr, /journal_unavailable/);
  assert.match(failure.stderr, /rpc_timeout/);
  assert.match(failure.stderr, /init/);
  assert.equal(failure.stderr.includes('private-guardian-start-canary'), false);
});
