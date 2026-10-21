import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runWorkflow } from './runner.mjs';
import { classifyActionFailure } from './failure.mjs';

for (const observerThrows of [false, true]) {
  test(`owned browser server is retained and closed (${observerThrows ? 'observer failure' : 'without observer'})`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'owned-server-'));
    const calls = [];
    const page = { locator: () => ({ click: async options => { assert.equal(options, undefined); calls.push('click'); } }) };
    const context = { setDefaultTimeout() {}, setDefaultNavigationTimeout() {}, route: async () => {}, newPage: async () => page, close: async () => { calls.push('context_closed'); } };
    const browser = { newContext: async () => context, close: async () => { calls.push('client_closed'); } };
    const server = { process: () => ({ pid: 999999 }), wsEndpoint: () => 'ws://127.0.0.1/fixture', close: async () => { calls.push('server_closed'); } };
    try {
      const result = await runWorkflow({ steps: [{ type: 'click', selector: 'button' }] }, {
        artifactsDir: directory,
        ...(observerThrows ? { onBrowserProcess: () => { throw new Error('fake-owner-private-canary'); } } : {}),
        playwright: { chromium: {
          launch: async () => { throw new Error('Legacy launch path used'); },
          launchServer: async options => { assert.equal(options.host, '127.0.0.1'); calls.push('server_launched'); return server; },
          connect: async endpoint => { assert.equal(endpoint, server.wsEndpoint()); calls.push('connected'); return browser; },
        } },
      });
      assert.equal(result.ok, !observerThrows);
      assert.equal(result.completed, observerThrows ? 0 : 1);
      assert.equal(calls.at(-1), 'server_closed');
      assert.equal(calls.filter(value => value === 'click').length, observerThrows ? 0 : 1);
      if (!observerThrows) assert.deepEqual(calls, ['server_launched', 'connected', 'click', 'context_closed', 'client_closed', 'server_closed']);
      assert.equal(JSON.stringify(result).includes('fake-owner-private-canary'), false);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}

test('unfinished native pointer action is distinguished from locator wait without exposing call text', () => {
  const error = { name: 'TimeoutError', message: 'fake-private-canary element is visible, enabled and stable\nperforming click action' };
  assert.equal(classifyActionFailure(error, { type: 'click' }), 'pointer_action_timeout');
  assert.equal(classifyActionFailure({ ...error, message: error.message + '\nclick action done' }, { type: 'click' }), 'locator_timeout');
  assert.equal(classifyActionFailure({ ...error, message: error.message + '\nelement is not stable' }, { type: 'click' }), 'not_stable');
});

test('late server ownership is stopped even when a trusted observer throws', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'late-owner-'));
  const controller = new AbortController();
  let killed = 0; let release; let started;
  const launchStarted = new Promise(resolve => { started = resolve; });
  const server = { process: () => ({ pid: 999999 }), close: async () => {}, kill: async () => { killed++; } };
  try {
    const pending = runWorkflow({ timeoutMs: 10000, steps: [{ type: 'click', selector: 'button' }] }, {
      artifactsDir: directory, signal: controller.signal,
      onBrowserProcess: () => { throw new Error('fake-late-private-canary'); },
      playwright: { chromium: { launchServer: () => { started(); return new Promise(resolve => { release = resolve; }); } } },
    });
    await launchStarted; controller.abort();
    const result = await pending;
    release(server);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(result.reason, 'cancelled');
    assert.equal(killed, 1);
    assert.equal(JSON.stringify(result).includes('fake-late-private-canary'), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
