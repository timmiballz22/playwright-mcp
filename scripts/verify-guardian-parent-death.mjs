// Source/installed-package real browser verification; no model turns.
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
const target = process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url));
const { JobJournal, supportsJournal } = await import(pathToFileURL(path.join(target, 'local-batch/jobs/journal.mjs')).href);
const { guardianDiagnostic } = await import(pathToFileURL(path.join(target, 'local-batch/jobs/guardian-diagnostic.mjs')).href);
const { ownedDescendants } = await import(pathToFileURL(path.join(target, 'local-batch/fixtures/process-audit.mjs')).href);
if (!supportsJournal) {
  process.stdout.write(JSON.stringify({ component: 'durable_guardian_parent_death', supported: false, requiredNode: '22.13+' }) + '\n');
} else {
const root = await mkdtemp(path.join(os.tmpdir(), 'guardian-real-parent-death-'));
const owner = fork(path.join(target, 'local-batch/fixtures/guardian-real-owner.mjs'), [root, ...(process.argv[3] === '--linger-journal-close' ? ['--linger-journal-close'] : [])], { stdio: ['ignore', 'pipe', 'ignore', 'ipc'], execArgv: [] });
const ownerExit = once(owner, 'exit');
const ownerFailures = [];
owner.on('message', packet => {
  if (packet?.type !== 'fixtureFailure' || ownerFailures.length >= 2) return;
  ownerFailures.push({ diagnostic: guardianDiagnostic(packet.diagnostic, packet.diagnostic?.stage, packet.diagnostic?.command),
    state: ['FAILED', 'CRASHED', 'CANCELLED', 'TIMED_OUT', 'SUCCEEDED'].includes(packet.state) ? packet.state : 'unknown' });
});
const readinessError = (code, exitCode = null, signal = 'none') => new Error(code + ': ' + JSON.stringify({
  exitCode: Number.isInteger(exitCode) ? exitCode : null,
  signal: ['SIGKILL', 'SIGTERM', 'SIGABRT', 'SIGSEGV', 'SIGINT'].includes(signal) ? signal : 'none',
  failures: ownerFailures,
}));
const lines = createInterface({ input: owner.stdout });
let journal; let timer; let observed = []; let safeToRemove = false; let verified = false; let primaryFailure;
try {
  const ready = await Promise.race([new Promise((resolve, reject) => lines.once('line', line => { try { resolve(JSON.parse(line)); } catch { reject(new Error('invalid_fixture_ready')); } })), new Promise((_, reject) => { timer = setTimeout(() => reject(readinessError('fixture_ready_timeout')), 15000); }), ownerExit.then(async ([code, signal]) => { if (owner.connected) await once(owner, 'disconnect'); throw readinessError('fixture_exited_before_ready', code, signal); })]);
  clearTimeout(timer);
  observed = await ownedDescendants(ready.roots, { rememberLiveRoots: true });
  assert.ok(observed.length >= 5, 'Real execution ownership was not observed');
  owner.kill('SIGKILL'); await ownerExit;
  // A terminal database row precedes guardian/journal process exit. Confirm
  // the old execution has fully stopped before creating a new observer process,
  // which could otherwise reuse an old recorded PID and confuse the audit.
  const shutdownStart = performance.now(); const end = shutdownStart + 10000;
  let remaining = await ownedDescendants(observed);
  while (remaining.length && performance.now() < end) {
    await new Promise(resolve => setTimeout(resolve, Math.min(50, Math.max(1, end - performance.now()))));
    remaining = await ownedDescendants(observed);
  }
  assert.deepEqual(remaining, [], 'Owned execution must exit within the original ten-second lifecycle bound');
  const shutdownMs = Math.round(performance.now() - shutdownStart);
  journal = await JobJournal.open({ directory: path.join(root, 'journal'), projectId: 'e'.repeat(64), ownerId: 'parent-death-fixture' });
  const row = await journal.call('read', { id: ready.jobId });
  assert.equal(row.state, 'CANCELLED'); assert.equal(row.operatorAttentionRequired, false);
  assert.equal(row.total, 2); assert.ok(row.completed >= 0 && row.completed <= 1);
  safeToRemove = true;
  const next = await journal.call('create', { id: randomUUID(), requestKey: 'after-cleanup', workflowDigest: 'f'.repeat(64), total: 1, deadlineAt: Date.now() + 10000 });
  const nonce = randomUUID(); assert.equal((await journal.call('reserve', { id: next.jobId, nonce })).acquired, true);
  await journal.call('cancel', { id: next.jobId }); await journal.call('activate', { id: next.jobId, nonce });
  assert.deepEqual(await journal.call('integrity'), { ok: true });
  console.log(JSON.stringify({ component: 'durable_guardian', controller: 'internal_job_controller', os: process.platform, realBrowser: 'chromium', controllerSignal: 'SIGKILL', observedOwnedProcesses: observed.length, terminalState: row.state, completed: row.completed, total: row.total, activeOwnedProcesses: 0, shutdownMs, ownedShutdownBeforeObserver: true, lingerJournalCloseFixture: process.argv[3] === '--linger-journal-close', projectLeaseReleased: true, integrity: true, modelTurns: 0 }));
  verified = true;
} catch (error) {
  primaryFailure = error; throw error;
} finally {
  clearTimeout(timer); lines.close(); owner.stdout.destroy();
  if (owner.exitCode === null && owner.signalCode === null) { owner.kill('SIGKILL'); await ownerExit; }
  let closeFailure;
  try { await journal?.close(); } catch (error) { closeFailure = error; }
  if (!safeToRemove && observed.length) {
    const cleanupEnd = performance.now() + 40000;
    while (performance.now() < cleanupEnd) {
      if (!(await ownedDescendants(observed)).length) { safeToRemove = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  // Keep the private diagnostic workspace if live ownership cannot be disproved.
  if (verified && safeToRemove && !closeFailure) await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  else console.error(JSON.stringify({ component: 'installed_parent_death_fixture_preserved', workspaceId: path.basename(root),
    verified, primaryFailed: !!primaryFailure, closeFailed: !!closeFailure, ownedAuditConfirmed: safeToRemove }));
  if (closeFailure) throw new AggregateError(primaryFailure ? [primaryFailure, closeFailure] : [closeFailure],
    'Installed parent-death fixture close failed', { cause: primaryFailure ?? closeFailure });
}

}
