import { test } from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { JobJournal, supportsJournal } from './journal.mjs';

async function withWorker(mode, body) {
  const fork = childProcess.fork; const timer = globalThis.setTimeout;
  const children = []; const operations = []; let closing = false;
  childProcess.fork = (module, ...args) => {
    if (!String(module).endsWith('journal-worker.mjs')) return fork(module, ...args);
    const child = new EventEmitter(); child.connected = true; child.kills = 0; child.unrefs = 0;
    child.kill = () => { child.kills++; return false; }; child.unref = () => { child.unrefs++; };
    child.disconnect = () => { child.connected = false; };
    child.send = (packet, callback) => queueMicrotask(() => {
      callback?.(null);
      if (closing) { child.emit('close'); return; }
      if (mode === 'silent') return;
      if (mode === 'malformed') { child.emit('message', null); return; }
      child.emit('message', mode === 'busy' && packet.command === 'init'
        ? { id: packet.id, ok: false, code: 'journal_busy' }
        : { id: packet.id, ok: true, value: packet.command === 'init' ? { schemaVersion: 1 } : { closed: true } });
    });
    children.push(child); queueMicrotask(() => { child.emit('spawn'); if (closing) child.emit('close'); });
    return child;
  };
  syncBuiltinESMExports();
  // Shorten only this isolated fault process's RPC/stop timers. No OS child or
  // PID receives a signal; production budgets remain unchanged.
  globalThis.setTimeout = (callback, delay, ...args) => timer(callback, [20, 1000].includes(delay) ? 1 : delay, ...args);
  const watch = operation => { operations.push(operation); void operation.catch(() => {}); return operation; };
  const ceiling = async operation => {
    let guard;
    try { return await Promise.race([operation, new Promise((_, reject) => { guard = timer(() => reject(new Error('Journal waited beyond its stop acknowledgement budget')), 250); })]); }
    finally { clearTimeout(guard); }
  };
  try { await body({ children, watch, ceiling }); }
  finally {
    closing = true; for (const child of children) child.emit('close');
    await Promise.allSettled(operations);
    childProcess.fork = fork; syncBuiltinESMExports(); globalThis.setTimeout = timer;
  }
}
const config = { directory: 'fake-private-journal-canary', projectId: 'f'.repeat(64), ownerId: 'owner', timeoutMs: 20 };

if (supportsJournal) test('journal init timeout reports unconfirmed exit without waiting forever or losing first cause', async () => {
  await withWorker('silent', async ({ children, watch, ceiling }) => {
    await assert.rejects(ceiling(watch(JobJournal.open(config))), error => {
      assert.equal(error.code, 'journal_unavailable'); assert.equal(error.journalFailure, 'rpc_timeout');
      assert.equal(error.journalFailureCommand, 'init'); assert.equal(error.journalExitConfirmed, false);
      assert.equal(JSON.stringify(error).includes('fake-private-journal-canary'), false); return true;
    });
    assert.equal(children.length, 1); assert.ok(children[0].kills >= 1);
    assert.equal(children[0].connected, false); assert.equal(children[0].unrefs, 1);
  });
});

if (supportsJournal) test('journal closed receipt alone cannot confirm worker shutdown', async () => {
  await withWorker('ack', async ({ children, watch, ceiling }) => {
    const journal = await JobJournal.open(config);
    await assert.rejects(ceiling(watch(journal.close())), error => {
      assert.equal(error.code, 'journal_unavailable'); assert.equal(error.journalExitConfirmed, false); return true;
    });
    await assert.rejects(journal.call('list'), { code: 'journal_unavailable', journalExitConfirmed: false });
    assert.ok(children[0].kills >= 1); assert.equal(children[0].connected, false); assert.equal(children[0].unrefs, 1);
  });
});

if (supportsJournal) test('busy initialization is not retried while its prior worker exit is unconfirmed', async () => {
  await withWorker('busy', async ({ children, watch, ceiling }) => {
    await assert.rejects(ceiling(watch(JobJournal.open(config))), error => {
      assert.equal(error.code, 'journal_busy'); assert.equal(error.journalExitConfirmed, false); return true;
    });
    assert.equal(children.length, 1, 'Only confirmed shutdown may permit a fresh init attempt');
    assert.equal(children[0].connected, false); assert.equal(children[0].unrefs, 1);
  });
});


if (supportsJournal) test('malformed journal IPC fails pending init safely instead of throwing outside its promise', async () => {
  await withWorker('malformed', async ({ watch, ceiling }) => {
    await assert.rejects(ceiling(watch(JobJournal.open(config))), error => {
      assert.equal(error.code, 'journal_unavailable'); assert.equal(error.journalFailure, 'invalid_response');
      assert.equal(error.journalExitConfirmed, false); return true;
    });
  });
});
