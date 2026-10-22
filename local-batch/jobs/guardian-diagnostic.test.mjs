import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardianDiagnostic, guardianDiagnosticLine } from './guardian-diagnostic.mjs';
import * as diagnostics from './guardian-diagnostic.mjs';
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


test('unconfirmed journal exit is a fixed boolean diagnostic without raw values', () => {
  const value = guardianDiagnostic({ code: 'journal_unavailable', journalFailure: 'closed', journalFailureCommand: 'close',
    journalExitConfirmed: false, message: 'fake-stop-private-canary' }, 'journal_close', 'close');
  assert.equal(value.journalExitConfirmed, false); assert.equal(value.stage, 'journal_close');
  assert.equal(guardianDiagnosticLine(value), 'Local job guardian failed (journal_close/journal_unavailable/close).\nLocal job journal unavailable (closed/close).\nLocal job journal worker exit unconfirmed.\n');
  const bad = guardianDiagnostic({ journalExitConfirmed: 'fake-stop-private-canary' }, 'unknown', 'unknown');
  assert.equal(bad.journalExitConfirmed, undefined);
  assert.equal(JSON.stringify(value).includes('fake-stop-private-canary'), false);
});

test('stderr facts accept only fixed endpoint diagnostics and discard unrelated text', () => {
  const value = diagnostics.guardianStderrFacts('private-ci-canary\nLocal job guardian failed (poll/journal_unavailable/read).\nLocal job journal unavailable (rpc_timeout/read).\nLocal job guardian exited (1/none).\nLocal job journal worker exit unconfirmed.\nLocal job guardian failed (private_ci_canary/private_ci_canary/read).\nLocal job guardian exited (2147483648/none).\nLocal job guardian exited (3221225477/none).\nLocal job guardian exited (4294967295/none).\nLocal job guardian exited (-2147483648/none).\nLocal job guardian exited (4294967296/none).\nLocal job guardian exited (-2147483649/none).\n');
  assert.deepEqual(value, { coverage: 'bounded_stderr_tail', guardianFailures: ['poll/journal_unavailable/read'], journalFailures: ['rpc_timeout/read'], guardianExits: ['1/none', '2147483648/none', '3221225477/none', '4294967295/none', '-2147483648/none'], journalExitUnconfirmed: true, inputTruncated: false, capped: false });
  assert.equal(JSON.stringify(value).includes('private'), false);
});

test('stderr facts cap distinct metadata and process only a bounded tail', () => {
  const value = diagnostics.guardianStderrFacts('private-ci-canary'.repeat(200000) + Array.from({ length: 20 }, (_, i) => `Local job guardian exited (${i}/none).\n`).join(''));
  assert.equal(value.inputTruncated, true); assert.equal(value.capped, true);
  assert.equal(value.guardianExits.length, 16); assert.ok(JSON.stringify(value).length < 2048);
  assert.equal(JSON.stringify(value).includes('private'), false);
  assert.deepEqual(diagnostics.guardianStderrFacts({ message: 'private-ci-canary' }).guardianFailures, []);
});

test('initialization phase diagnostics retain only fixed stages and remain bounded', () => {
  const value = { code: 'journal_unavailable', journalFailure: 'rpc_timeout', journalFailureCommand: 'init', journalInitStage: 'configure' };
  const safe = guardianDiagnostic(value, 'journal_open', 'init');
  assert.equal(safe.journalInitStage, 'configure');
  const line = guardianDiagnosticLine(safe);
  assert.match(line, /Local job journal init phase \(configure\)/);
  const facts = diagnostics.guardianStderrFacts(line);
  assert.deepEqual(facts.journalInitStages, ['configure']);
  assert.equal(facts.capped, false);
  assert.equal(guardianDiagnostic({ ...value, journalInitStage: 'private-canary' }, 'journal_open', 'init').journalInitStage, undefined);
  assert.equal(diagnostics.guardianStderrFacts('Local job journal init phase (private-canary).').journalInitStages, undefined);
  assert.equal(diagnostics.guardianStderrFacts(('Local job journal init phase (configure).\n').repeat(200)).journalInitStages.length, 1);
});
