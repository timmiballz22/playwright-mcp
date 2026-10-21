import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardianDiagnostic, guardianDiagnosticLine } from './guardian-diagnostic.mjs';
test('guardian diagnostics retain fixed journal metadata and discard private values', () => {
  assert.deepEqual(guardianDiagnostic({ code: 'storage_full', message: 'private-canary' }, 'write', 'resources'), { stage: 'write', code: 'storage_full', command: 'resources' });
  const value = { code: 'private-canary', stage: 'private-canary', command: 'private-canary', message: 'private-canary' };
  assert.equal(guardianDiagnosticLine(value), 'Local job guardian failed (unknown/guardian_failed/none).\n');
});
