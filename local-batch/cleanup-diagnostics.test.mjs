import { stepFailureDiagnostic } from './failure.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runWorkflow } from './runner.mjs';

for (const failure of ['timeout', 'error']) {
  test(`cooperative context cleanup ${failure} retains fixed stage and stays failed`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'cleanup-stage-'));
    const realTimeout = globalThis.setTimeout;
    // Only the engine's fixed cleanup guard is shortened, in this test process.
    globalThis.setTimeout = (callback, delay, ...args) => realTimeout(callback, delay === 5000 ? 20 : delay, ...args);
    let browserClosed = false;
    const page = { locator: () => ({ click: async () => {} }) };
    const context = { setDefaultTimeout() {}, setDefaultNavigationTimeout() {}, route: async () => {}, newPage: async () => page,
      close: () => failure === 'timeout' ? new Promise(() => {}) : Promise.reject(new Error('fake-cleanup-private-canary')) };
    const browser = { newContext: async () => context, close: async () => { browserClosed = true; } };
    try {
      const result = await runWorkflow({ timeoutMs: 1000, steps: [{ type: 'click', selector: 'button' }] }, {
        artifactsDir: directory, playwright: { chromium: { launch: async () => browser } },
      });
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'cleanup_failed');
      assert.equal(result.actionsSucceeded, true);
      assert.equal(browserClosed, true);
      assert.deepEqual(result.cleanupFailures, ['context_' + failure]);
      assert.equal(JSON.stringify(result).includes('fake-cleanup-private-canary'), false);
    } finally { globalThis.setTimeout = realTimeout; await rm(directory, { recursive: true, force: true }); }
  });
}

test('untrusted Retry-After hints cannot exceed bounded durable result metadata', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'retry-metadata-'));
  try {
    for (const [header, expected] of [['0', 0], ['2', 2000], ['86400', 86400000], ['86401', undefined], ['9'.repeat(30), undefined], ['invalid', undefined]]) {
      const page = { goto: async () => ({ status: () => 429, headers: () => ({ 'retry-after': header }) }) };
      const context = { setDefaultTimeout() {}, setDefaultNavigationTimeout() {}, route: async () => {}, newPage: async () => page, close: async () => {} };
      const browser = { newContext: async () => context, close: async () => {} };
      const result = await runWorkflow({ steps: [{ type: 'goto', url: 'http://127.0.0.1:4321/' }] }, {
        allowedOrigins: ['http://127.0.0.1:4321'], artifactsDir: directory, playwright: { chromium: { launch: async () => browser } },
      });
      assert.equal(result.ok, false);
      assert.equal(result.results[0].error, 'rate_limited');
      assert.equal(result.results[0].retryAfterMs, expected);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('all three close failures plus final server kill failure remain bounded fixed metadata', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cleanup-all-stages-'));
  const fail = async () => { throw new Error('fake-all-cleanup-private-canary'); };
  const page = { locator: () => ({ click: async () => {} }) };
  const context = { setDefaultTimeout() {}, setDefaultNavigationTimeout() {}, route: async () => {}, newPage: async () => page, close: fail };
  const browser = { newContext: async () => context, close: fail };
  const server = { process: () => ({ pid: process.pid }), wsEndpoint: () => 'ws://127.0.0.1/owned-mock', close: fail, kill: fail };
  try {
    const result = await runWorkflow({ steps: [{ type: 'click', selector: 'button' }] }, {
      artifactsDir: directory, playwright: { chromium: { launchServer: async () => server, connect: async () => browser } },
    });
    assert.equal(result.ok, false); assert.equal(result.reason, 'cleanup_failed');
    assert.equal(result.actionsSucceeded, true); assert.equal(result.completed, 1);
    assert.deepEqual(result.cleanupFailures, ['context_error', 'browser_error', 'server_error', 'server_kill_error']);
    assert.equal(JSON.stringify(result).includes('fake-all-cleanup-private-canary'), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('client step failure receipts retain fixed taxonomy without private step fields', () => {
  const canary = 'fake-private-step-canary';
  const safe = stepFailureDiagnostic({ index: 2, repetition: 1, type: 'click', error: 'action_failed',
    failureKind: 'locator_timeout', durationMs: 5000, selector: canary, url: canary, value: canary,
    artifact: canary, message: canary, nested: { token: canary } });
  assert.deepEqual(JSON.parse(JSON.stringify(safe)), { index: 2, repetition: 1, type: 'click', error: 'action_failed', failureKind: 'locator_timeout', durationMs: 5000 });
  assert.equal(JSON.stringify(safe).includes(canary), false);
  const unknown = stepFailureDiagnostic({ index: 1001, repetition: 101, type: canary, error: canary,
    failureKind: canary, durationMs: Infinity, httpStatus: 200 });
  assert.deepEqual(JSON.parse(JSON.stringify(unknown)), { type: 'unknown', error: 'unknown', failureKind: 'unknown' });
  assert.equal(stepFailureDiagnostic(null), null); assert.equal(stepFailureDiagnostic([]), null);
  const http = stepFailureDiagnostic({ index: 1, type: 'goto', error: 'http_404', failureKind: 'http_failure', httpStatus: 404 });
  assert.equal(http.httpStatus, 404);
  const setup = stepFailureDiagnostic({ index: 0, type: 'setup', error: 'setup_failed', message: canary });
  assert.deepEqual(JSON.parse(JSON.stringify(setup)), { index: 0, type: 'setup', error: 'setup_failed', failureKind: 'unknown' });
});
