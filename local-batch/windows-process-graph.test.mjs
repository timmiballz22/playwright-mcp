import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windowsOwnedProcesses, windowsCimFailurePhase, windowsAuditReceipt } from './fixtures/windows-process-graph.mjs';
const time = value => '2026-10-21T00:00:00.' + String(value).padStart(7, '0') + 'Z';
const row = (pid, parent, started) => ({ pid, parent, started: started === null ? null : time(started) });
test('audit receipts describe reused IDs without hiding possible processes or exposing identities', () => {
  const rows = [{ pid: 900, parent: 1, started: '2026-10-21T00:00:02.0000000Z', command: 'fake-audit-private-canary' },
    { pid: 901, parent: 900, started: '2026-10-21T00:00:01.0000000Z' }];
  const identities = new Map();
  const observed = windowsOwnedProcesses([900], rows, identities);
  assert.deepEqual(observed, [900, 901], 'Unknown legacy roots must remain conservative');
  const receipt = windowsAuditReceipt([900], rows, observed, 900, identities, Date.parse('2026-10-21T00:00:01.500Z'));
  assert.deepEqual(receipt, { observedCount: 2, auditHelperMatched: true, rootMatches: 1,
    rememberedRootBirths: 0, birthsBeforeObservationWindow: 1, missingObservedBirths: 0 });
  for (const secret of ['900', '901', '2026', 'fake-audit-private-canary']) assert.equal(JSON.stringify(receipt).includes(secret), false);
  assert.deepEqual(observed, [900, 901], 'Diagnostics must not filter the ownership result');
  identities.set(900, '2026-10-21T00:00:00.0000000Z');
  const precise = windowsOwnedProcesses([900], rows, identities);
  assert.deepEqual(precise, [901], 'Known birth excludes only the replacement, preserving an older child');
  assert.deepEqual(windowsAuditReceipt([900], rows, precise, 900, identities), {
    observedCount: 1, auditHelperMatched: false, rootMatches: 0, rememberedRootBirths: 1,
    birthsBeforeObservationWindow: null, missingObservedBirths: 0,
  });
});
test('older processes with recycled parent IDs are excluded while real live descendants remain', () => {
  const identities = new Map();
  const rows = [row(900, 1, 100), row(100, 900, 10), row(901, 900, 110), row(902, 901, 120)];
  assert.deepEqual(windowsOwnedProcesses([900], rows, identities, true), [900, 901, 902]);
  assert.equal(identities.has(100), false);
});
test('reused root identity excludes its replacement but still reports earlier surviving children', () => {
  const identities = new Map([[900, time(100)]]);
  assert.deepEqual(windowsOwnedProcesses([900], [row(900, 1, 200), row(901, 900, 150), row(902, 900, 250), row(903, 901, 160)], identities), [901, 903]);
  assert.deepEqual(windowsOwnedProcesses([900], [row(900, 1, 200), row(902, 900, 250)], identities), []);
});
test('missing identity is uncertainty, while unknown legacy roots never hide potential orphans', () => {
  assert.throws(() => windowsOwnedProcesses([900], [], new Map(), true), { message: 'process_audit_windows_identity_unavailable_root_missing' });
  assert.throws(() => windowsOwnedProcesses([900], [row(900, 1, 200)], new Map([[900, time(100)]]), true), { message: 'process_audit_windows_identity_unavailable_root_birth_changed' });
  assert.throws(() => windowsOwnedProcesses([900], [row(900, 1, null)], new Map(), true), /identity_unavailable/);
  assert.throws(() => windowsOwnedProcesses([900], [row(900, 1, 90)], new Map([[900, time(100)]])), /identity_unavailable/);
  assert.deepEqual(windowsOwnedProcesses([900], [row(901, 900, null)]), [901]);
  assert.throws(() => windowsOwnedProcesses([900], [row(900, 1, 100), row(901, 900, null)], new Map(), true), /identity_unavailable/);
});

test('live-root snapshots retain exited browser identities for the final orphan scan', () => {
  const identities = new Map();
  windowsOwnedProcesses([900], [row(900, 1, 100), row(901, 900, 110), row(902, 901, 120)], identities, true);
  const nextLaunch = [row(900, 1, 100), row(902, 901, 120), row(910, 900, 200)];
  assert.throws(() => windowsOwnedProcesses([900, 901], nextLaunch, identities, true), /identity_unavailable/);
  assert.deepEqual(windowsOwnedProcesses([900], nextLaunch, identities, true), [900, 910]);
  assert.deepEqual(windowsOwnedProcesses([900, 901, 910], [row(902, 901, 120)], identities), [902]);
  assert.deepEqual(windowsOwnedProcesses([900, 901, 910], [], identities), []);
});


test('CIM error phase keeps only exact fixed markers and never raw diagnostics', () => {
  assert.equal(windowsCimFailurePhase(undefined), 'unknown');
  assert.equal(windowsCimFailurePhase('PWMCP_AUDIT_PHASE=query\nPWMCP_AUDIT_PHASE=projection\n'), 'projection');
  assert.equal(windowsCimFailurePhase('private-canary PWMCP_AUDIT_PHASE=query'), 'unknown');
  assert.equal(windowsCimFailurePhase('PWMCP_AUDIT_PHASE=private-canary'), 'unknown');
  assert.equal(windowsCimFailurePhase('PWMCP_AUDIT_PHASE=entered\r\nPWMCP_AUDIT_PHASE=query\r\nprivate-canary'), 'query');
  assert.equal(windowsCimFailurePhase('PWMCP_AUDIT_PHASE=serialization\nPWMCP_AUDIT_PHASE=done\n'), 'done');
});
