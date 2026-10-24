import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { supportsJournal } from './jobs/journal.mjs';
if (supportsJournal) test('controller crash observes complete owned shutdown before opening a replacement journal worker', { timeout: 45000 }, async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const { stdout } = await promisify(execFile)(process.execPath, ['scripts/verify-guardian-parent-death.mjs', root, '--linger-journal-close'], { cwd: root, timeout: 40000, maxBuffer: 65536 });
  const result = JSON.parse(stdout.trim());
  assert.equal(result.terminalState, 'CANCELLED'); assert.equal(result.activeOwnedProcesses, 0);
  assert.equal(result.ownedShutdownBeforeObserver, true); assert.equal(result.lingerJournalCloseFixture, true);
  assert.equal(result.projectLeaseReleased, true); assert.equal(result.integrity, true);
  assert.ok(result.shutdownMs < 10000);
});
