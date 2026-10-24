// Optional Linux read-only listener audit during real supervised browser work.
// No port scan, global listener attribution, process killing or raw endpoints.
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, readlink, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { executeWorkflow } from '../local-batch/executor.mjs';
import { ownedDescendants } from '../local-batch/fixtures/process-audit.mjs';
if (process.platform !== 'linux') throw new Error('active_listener_audit_linux_only');
const directory = await mkdtemp(path.join(os.tmpdir(), 'active-listener-audit-'));
const fixture = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<title>Owned listener audit</title>'); });
fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
const origin = `http://127.0.0.1:${fixture.address().port}`;
const roots = []; const abort = new AbortController(); let workerPid; let arrived; let pending; let verified = false; let phaseTimer;
const navigated = new Promise(resolve => { arrived = resolve; });
let summary;
try {
  pending = executeWorkflow({ timeoutMs: 30000, steps: [{ type: 'goto', url: origin }, { type: 'waitFor', selector: '#never-present' }] }, {
    artifactsDir: directory, allowedOrigins: [origin], signal: abort.signal,
    onEvent: event => {
      if (event.pid) roots.push(event.pid);
      if (event.type === 'workerSpawned') workerPid = event.pid;
      if (event.type === 'progress' && event.completed === 1) arrived();
    },
  });
  await Promise.race([navigated, new Promise((_, reject) => { phaseTimer = setTimeout(() => reject(new Error('navigation_phase_not_observed')), 15000); })]);
  clearTimeout(phaseTimer);
  assert.ok(Number.isInteger(workerPid));
  const owned = await ownedDescendants(roots, { rememberLiveRoots: true }); assert.ok(owned.includes(workerPid));
  const sockets = new Map(); const unreadable = new Set();
  for (const pid of owned) {
    let descriptors;
    try { descriptors = await readdir(`/proc/${pid}/fd`); }
    catch (error) { if (['EACCES', 'EPERM'].includes(error.code)) { unreadable.add(pid); continue; } throw error; }
    for (const descriptor of descriptors) {
      let target;
      try { target = await readlink(`/proc/${pid}/fd/${descriptor}`); }
      catch (error) {
        if (error.code === 'ENOENT') continue;
        if (['EACCES', 'EPERM'].includes(error.code)) { unreadable.add(pid); continue; }
        throw error;
      }
      const match = /^socket:\[(\d+)\]$/.exec(target);
      if (match) { const pids = sockets.get(match[1]) ?? new Set(); pids.add(pid); sockets.set(match[1], pids); }
    }
  }
  assert.equal(unreadable.has(workerPid), false, 'Worker listener attribution must be complete');
  let listeners = 0; let workerListeners = 0;
  for (const table of ['tcp', 'tcp6']) {
    for (const line of (await readFile('/proc/net/' + table, 'utf8')).trim().split('\n').slice(1)) {
      const fields = line.trim().split(/\s+/); const owners = sockets.get(fields[9]);
      if (fields[3] !== '0A' || !owners) continue;
      const address = fields[1].split(':')[0];
      const loopback = table === 'tcp' ? address === '0100007F' : address === '00000000000000000000000001000000';
      assert.equal(loopback, true, 'Observed owned listener is not exact loopback');
      listeners++; if (owners.has(workerPid)) workerListeners++;
    }
  }
  assert.equal(workerListeners, 1, 'Expected the public BrowserServer listener on its owned worker');
  summary = { os: 'linux', phase: 'navigation_complete_browser_active', ownedProcesses: owned.length, observedOwnedTcpListeners: listeners, workerTcpListeners: workerListeners, allObservedListenersExactLoopback: true, unreadableFdProcesses: unreadable.size, socketCoverage: unreadable.size ? 'partial_permission_denied' : 'point_in_time_owned_fds', modelTurns: 0, limitation: 'Point-in-time TCP listener attribution only. Unreadable browser descriptors prevent a full-tree absence claim; no DNS/UDP/egress sandbox proof.' };
  abort.abort(); const result = await pending;
  assert.equal(result.reason, 'cancelled'); assert.equal(result.completed, 1);
  assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
  assert.deepEqual(await ownedDescendants([...roots, ...owned]), []);
  verified = true;
} finally {
  clearTimeout(phaseTimer); abort.abort(); if (pending) await pending.catch(() => {});
  fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
  if (verified) await rm(directory, { recursive: true, force: true });
}
console.log(JSON.stringify({ ...summary, activeOwnedProcessesAfterShutdown: 0 }));
