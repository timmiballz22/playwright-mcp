import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windowsOwnedProcesses, windowsOwnedProcessScopes, windowsCimFailurePhase, windowsAuditReceipt } from './fixtures/windows-process-graph.mjs';
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


test('separate owned lifetimes retain old orphans when a new client reuses its PID', () => {
  const earlier = { roots: new Set([900]), identities: new Map() };
  assert.deepEqual(windowsOwnedProcessScopes([earlier], [row(900, 1, 100)], true), [900]);
  const later = { roots: new Set([900]), identities: new Map() };
  const replacement = [row(900, 1, 200), row(901, 900, 150), row(902, 900, 250), row(903, 901, 160)];
  // The previous one-map registration fails closed here, as seen natively.
  assert.throws(() => windowsOwnedProcesses([900], replacement, earlier.identities, true), /root_birth_changed/);
  assert.deepEqual(windowsOwnedProcessScopes([later], replacement, true), [900, 902]);
  assert.deepEqual(windowsOwnedProcessScopes([earlier, later], replacement), [900, 901, 902, 903]);
  assert.equal(earlier.identities.get(900), time(100)); assert.equal(later.identities.get(900), time(200));
  assert.deepEqual(windowsOwnedProcessScopes([earlier, later], [row(901, 900, 150), row(903, 901, 160)]), [901, 903]);
  assert.throws(() => windowsOwnedProcessScopes([later], [row(900, 1, 300)], true), /root_birth_changed/,
    'A changed identity inside one lifetime remains uncertain');
});


test('new client may reuse an earlier observed descendant without losing either orphan lineage', () => {
  const earlier = { roots: new Set([900]), identities: new Map() };
  windowsOwnedProcessScopes([earlier], [row(900, 1, 100), row(901, 900, 110)], true);
  const later = { roots: new Set([901]), identities: new Map() };
  const rows = [row(901, 1, 200), row(902, 901, 150), row(903, 901, 250)];
  windowsOwnedProcessScopes([later], rows, true);
  assert.deepEqual(windowsOwnedProcessScopes([earlier, later], rows), [901, 902, 903]);
  const unrelatedReplacement = [row(901, 1, 300), row(902, 901, 150), row(903, 901, 250), row(904, 901, 350)];
  assert.deepEqual(windowsOwnedProcessScopes([earlier, later], unrelatedReplacement), [902, 903],
    'Both earlier owned branches survive; a later unrelated incarnation is not promoted to owned');
});


test('live controller anchors retain exited browser roots and reject changes within that lifetime', () => {
  const scope = { roots: new Set([900]), liveRoots: new Set([900]), identities: new Map() };
  windowsOwnedProcessScopes([scope], [row(900, 1, 100), row(901, 900, 110)], true);
  assert.deepEqual(windowsOwnedProcessScopes([scope], [row(900, 1, 100), row(902, 901, 120), row(910, 900, 200)], true), [900, 902, 910]);
  assert.throws(() => windowsOwnedProcessScopes([scope], [row(900, 1, 300), row(902, 901, 120)], true), /root_birth_changed/);
  assert.throws(() => windowsOwnedProcessScopes([scope], [row(902, 901, 120)], true), /root_missing/);
});

test('live anchor refresh preserves an old orphan before recording a new owned browser incarnation', () => {
  const scope = { roots: new Set([900]), liveRoots: new Set([900]), identities: new Map() };
  windowsOwnedProcessScopes([scope], [row(900, 1, 100), row(901, 900, 110)], true);
  const reused = [row(900, 1, 100), row(901, 900, 200), row(902, 901, 150), row(903, 901, 250)];
  assert.deepEqual(windowsOwnedProcessScopes([scope], reused, true), [900, 901, 902, 903]);
  assert.deepEqual(windowsOwnedProcessScopes([scope], [row(900, 1, 100), row(902, 901, 150), row(903, 901, 250)], true), [900, 902, 903]);
});


test('historical PID links cannot rewrite a live controller identity before validation', () => {
  const scope = { roots: new Set([900]), liveRoots: new Set([900]), identities: new Map() };
  windowsOwnedProcessScopes([scope], [row(900, 1, 100), row(901, 900, 110)], true);
  assert.throws(() => windowsOwnedProcessScopes([scope], [row(901, 1, 110), row(900, 901, 300)], true), /root_birth_changed/);
  assert.equal(scope.identities.get(900), time(100));
});

test('legacy comparison preserves old candidates while scoped birth facts retain an owned orphan', async () => {
  const { windowsLegacyComparison, windowsOwnedProcesses } = await import('./fixtures/windows-process-graph.mjs');
  const rows = [
    { pid: 101, parent: 100, started: '2026-10-21T00:00:01.0000000Z' },
    { pid: 102, parent: 100, started: '2026-10-21T00:00:03.0000000Z' },
  ];
  const identities = new Map([[100, '2026-10-21T00:00:02.0000000Z']]);
  const scoped = windowsOwnedProcesses([100], rows, identities);
  assert.deepEqual(scoped, [102]);
  const comparison = windowsLegacyComparison([100], rows, scoped);
  assert.deepEqual(comparison.observed, [101, 102]); assert.deepEqual(comparison.legacyOnly, [101]);
  assert.deepEqual(comparison.rows, rows); assert.deepEqual(scoped, [102]);
});
