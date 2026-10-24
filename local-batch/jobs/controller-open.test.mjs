import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobController } from './controller.mjs';
import { JobJournal, JournalError } from './journal.mjs';
import { guardianDiagnostic } from './guardian-diagnostic.mjs';

test('controller recovery failure remains primary if journal shutdown also fails', async () => {
  const originalOpen = JobJournal.open;
  const primary = new JournalError('journal_corrupt', 'invalid_response', 'recover');
  const shutdown = new JournalError('journal_unavailable', 'closed', 'close', false);
  primary.message = 'private-recovery-canary'; shutdown.message = 'private-close-canary';
  let calls = 0; let closes = 0;
  JobJournal.open = async () => ({ call: async command => {
    calls++; assert.equal(command, 'recover'); throw primary;
  }, close: async () => { closes++; throw shutdown; } });
  try {
    await assert.rejects(JobController.open({ journal: {} }), error => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.cause, primary); assert.deepEqual(error.errors, [primary, shutdown]);
      assert.equal(error.code, 'journal_corrupt');
      assert.equal(error.journalFailure, 'invalid_response'); assert.equal(error.journalFailureCommand, 'recover');
      assert.equal(error.journalExitConfirmed, false);
      assert.equal(JSON.stringify(guardianDiagnostic(error, 'journal_open', 'recover')).includes('canary'), false);
      return true;
    });
    assert.equal(calls, 1); assert.equal(closes, 1);
  } finally { JobJournal.open = originalOpen; }
});

test('controller recovery failure identity is unchanged after confirmed journal shutdown', async () => {
  const originalOpen = JobJournal.open;
  const primary = new JournalError('journal_busy'); let closes = 0;
  JobJournal.open = async () => ({ call: async () => { throw primary; }, close: async () => { closes++; } });
  try {
    await assert.rejects(JobController.open({ journal: {} }), error => error === primary);
    assert.equal(closes, 1);
  } finally { JobJournal.open = originalOpen; }
});
