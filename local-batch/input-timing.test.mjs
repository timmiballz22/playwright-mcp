import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runWorkflow } from './runner.mjs';
import { classifyActionFailure } from './failure.mjs';

for (const fails of [false, true]) {
  test(`native input policy preserves one locator call without force or replay (${fails ? 'failure' : 'success'})`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'input-policy-'));
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    try {
      for (const [platform, browser, expected] of [['win32', 'firefox', { delay: 1 }], ['win32', 'chromium', undefined], ['linux', 'firefox', undefined]]) {
        const calls = [];
        let observedPage;
        const page = { locator: () => ({ click: async options => {
          calls.push(options);
          if (fails) throw new Error('fake-input-private-canary');
        } }) };
        const context = { setDefaultTimeout() {}, setDefaultNavigationTimeout() {}, route: async () => {}, newPage: async () => page, close: async () => {} };
        const instance = { newContext: async () => context, close: async () => {} };
        Object.defineProperty(process, 'platform', { value: platform, configurable: true });
        const result = await runWorkflow({ browser, steps: [{ type: 'click', selector: 'button' }] }, {
          artifactsDir: directory, playwright: { [browser]: { launch: async () => instance } },
          onActionFailure: (error, step, livePage) => { observedPage = livePage; },
        });
        assert.deepEqual(calls, [expected]);
        assert.equal(observedPage, fails ? page : undefined);
        assert.equal(result.ok, !fails);
        assert.equal(result.completed, fails ? 0 : 1);
        assert.equal(JSON.stringify(result).includes('fake-input-private-canary'), false);
      }
    } finally { Object.defineProperty(process, 'platform', originalPlatform); await rm(directory, { recursive: true, force: true }); }
  });
}


test('unfinished native pointer action is distinguished from locator wait without exposing call text', () => {
  const error = { name: 'TimeoutError', message: 'fake-private-canary element is visible, enabled and stable\nperforming click action' };
  assert.equal(classifyActionFailure(error, { type: 'click' }), 'pointer_action_timeout');
  assert.equal(classifyActionFailure({ ...error, message: error.message + '\nclick action done' }, { type: 'click' }), 'locator_timeout');
  assert.equal(classifyActionFailure({ ...error, message: error.message + '\nelement is not stable' }, { type: 'click' }), 'not_stable');
});
