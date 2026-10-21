import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windowsOwnedProcesses } from './fixtures/windows-process-graph.mjs';
const time = value => '2026-10-21T00:00:00.' + String(value).padStart(7, '0') + 'Z';
const row = (pid, parent, started) => ({ pid, parent, started: started === null ? null : time(started) });
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
