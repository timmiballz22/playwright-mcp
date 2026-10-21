import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardianDiagnostic, guardianDiagnosticLine } from './guardian-diagnostic.mjs';
test('guardian diagnostics retain fixed journal metadata and discard private values', () => {
  assert.deepEqual(guardianDiagnostic({ code: 'storage_full', message: 'private-canary' }, 'write', 'resources'), { stage: 'write', code: 'storage_full', command: 'resources' });
  const value = { code: 'private-canary', stage: 'private-canary', command: 'private-canary', message: 'private-canary' };
  assert.equal(guardianDiagnosticLine(value), 'Local job guardian failed (unknown/guardian_failed/none).\n');
});

test('journal transport diagnostics retain only fixed causes and originating verbs', () => {
  const safe = guardianDiagnostic({ code: 'journal_unavailable', journalFailure: 'rpc_timeout', journalFailureCommand: 'create', message: 'private-canary' }, 'poll', 'read');
  assert.deepEqual(safe, { stage: 'poll', code: 'journal_unavailable', command: 'read', journalFailure: 'rpc_timeout', journalFailureCommand: 'create' });
  assert.equal(guardianDiagnosticLine(safe), 'Local job guardian failed (poll/journal_unavailable/read).\nLocal job journal unavailable (rpc_timeout/create).\n');
  assert.equal(guardianDiagnosticLine({ code: 'journal_unavailable', stage: 'poll', command: 'read', journalFailure: 'private-canary', journalFailureCommand: 'private-canary' }).includes('private-canary'), false);
  assert.equal(guardianDiagnosticLine({ ...safe, journalFailureCommand: 'private-canary' }), 'Local job guardian failed (poll/journal_unavailable/read).\nLocal job journal unavailable (rpc_timeout/none).\n');
});
