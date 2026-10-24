import { test } from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import { cleanupTemporaryDirectory } from '../cleanup.mjs';

async function withWorker(mode, body) {
  const fork = childProcess.fork; const timer = globalThis.setTimeout;
  const children = []; const operations = []; const delayed = [];
  const clockDescriptor = Object.getOwnPropertyDescriptor(performance, 'now'); let clock = 0;
  if (mode === 'late') Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
  childProcess.fork = (module, ...args) => {
    if (path.basename(String(module)) !== 'cleanup-worker.mjs') return fork(module, ...args);
    const child = new EventEmitter(); child.pid = 2147483647; child.connected = true; child.kills = 0; child.unrefs = 0;
    child.kill = () => { child.kills++; return false; }; child.unref = () => { child.unrefs++; };
    child.disconnect = () => { child.connected = false; };
    child.send = (_packet, callback) => queueMicrotask(() => {
      callback?.(null);
      if (mode === 'error') { child.emit('error', new Error('private-cleanup-canary')); child.emit('error', new Error('private-cleanup-canary')); }
      else if (mode === 'malformed') child.emit('message', null);
      else if (mode === 'ack') child.emit('message', { ok: true });
      else if (mode === 'late') { child.emit('message', { ok: true }); clock = 101; child.emit('exit', 0, null); child.emit('close', 0, null); }
      else if (mode === 'drain') {
        child.emit('exit', 0, null);
        delayed.push(timer(() => { child.emit('message', { ok: true }); child.connected = false; child.emit('close', 0, null); }, 10));
      }
    });
    children.push(child); return child;
  };
  syncBuiltinESMExports();
  // Private fake handles only: no OS PID is signalled or filesystem touched.
  globalThis.setTimeout = (callback, delay, ...args) => timer(callback, [20, 1000].includes(delay) ? 1 : delay, ...args);
  const run = async timeoutMs => {
    const operation = cleanupTemporaryDirectory('private-cleanup-canary', timeoutMs); operations.push(operation);
    let guard;
    try { return await Promise.race([operation, new Promise((_, reject) => { guard = timer(() => reject(new Error('Cleanup stop confirmation was not bounded')), 250); })]); }
    finally { clearTimeout(guard); }
  };
  try { await body({ children, run }); }
  finally {
    for (const handle of delayed) clearTimeout(handle);
    for (const child of children) { child.emit('exit', 1, 'SIGKILL'); child.emit('close', 1, 'SIGKILL'); }
    await Promise.allSettled(operations);
    childProcess.fork = fork; syncBuiltinESMExports(); globalThis.setTimeout = timer;
    if (mode === 'late') { if (clockDescriptor) Object.defineProperty(performance, 'now', clockDescriptor); else delete performance.now; }
  }
}

test('temporary cleanup receipt cannot authorize success without confirmed worker exit', async () => {
  await withWorker('ack', async ({ children, run }) => {
    assert.equal(await run(20), false);
    assert.ok(children[0].kills > 0); assert.equal(children[0].connected, false); assert.equal(children[0].unrefs, 1);
  });
});
test('temporary cleanup repeated IPC errors retain owned-handle termination and uncertainty', async () => {
  await withWorker('error', async ({ children, run }) => {
    assert.equal(await run(20), false);
    assert.ok(children[0].kills > 0); assert.equal(children[0].unrefs, 1);
  });
});
test('malformed cleanup receipt fails closed without an uncaught message handler exception', async () => {
  await withWorker('malformed', async ({ children, run }) => {
    assert.equal(await run(20), false); assert.ok(children[0].kills > 0);
  });
});
test('temporary cleanup drains its final receipt after process exit before confirming success', async () => {
  await withWorker('drain', async ({ children, run }) => {
    assert.equal(await run(100), true); assert.equal(children[0].kills, 0); assert.equal(children[0].unrefs, 0);
  });
});


test('a late natural cleanup receipt cannot win before a delayed timeout callback', async () => {
  // Advance only the observed monotonic clock; leave the timer undelivered.
  await withWorker('late', async ({ run }) => { assert.equal(await run(100), false); });
});
