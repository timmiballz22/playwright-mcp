import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
const require = createRequire(import.meta.url);
const { installProfileGuard } = require('./profile-guard.cjs');
const { acquireProfileLease } = require('./profile-lease.cjs');
function fakeContext() {
  let closed = false; let closes = 0;
  const browser = { close: async () => { closed = true; } };
  return { isClosed: () => closed, browser: () => browser, close: async () => { closes++; closed = true; },
    crash: () => { closed = true; }, get closes() { return closes; } };
}
test('guard composes public persistent API, refuses another launch and releases after confirmed public close', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'profile-guard-'));
  const type = { launchPersistentContext: async () => fakeContext() };
  installProfileGuard({ chromium: type }); const installed = type.launchPersistentContext;
  installProfileGuard({ chromium: type }); assert.equal(type.launchPersistentContext, installed);
  try {
    const first = await type.launchPersistentContext(root);
    await assert.rejects(type.launchPersistentContext(root), { code: 'profile_in_use' });
    await first.browser().close(); assert.equal(first.closes, 1);
    await first.close();
    const next = await type.launchPersistentContext(root); await next.close();
    assert.deepEqual(await readdir(root), []);
    const ephemeral = await type.launchPersistentContext(''); await ephemeral.close();
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('failed launch and disconnected context retain uncertain ownership without stale deletion', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'profile-guard-uncertain-'));
  try {
    const failing = { launchPersistentContext: async () => { throw new Error('owned_launch_failure'); } };
    installProfileGuard({ firefox: failing });
    await assert.rejects(failing.launchPersistentContext(path.join(root, 'failed')), /owned_launch_failure/);
    await assert.rejects(acquireProfileLease(path.join(root, 'failed')), { code: 'profile_cleanup_unknown' });
    const type = { launchPersistentContext: async () => fakeContext() }; installProfileGuard({ webkit: type });
    const profile = path.join(root, 'crashed'); const context = await type.launchPersistentContext(profile); context.crash();
    await assert.rejects(context.browser().close(), { code: 'profile_cleanup_unknown' });
    await assert.rejects(acquireProfileLease(profile), { code: 'profile_cleanup_unknown' });
    assert.deepEqual(await readdir(profile), ['.playwright-mcp-owner']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('closed event before acknowledged shutdown cannot free a profile, and failed hook setup closes its allocation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'profile-guard-ack-'));
  try {
    let finish; let closed = false;
    const ack = new Promise(resolve => { finish = resolve; });
    const context = { isClosed: () => closed, browser: () => null, close: async () => { closed = true; await ack; } };
    const type = { launchPersistentContext: async () => context }; installProfileGuard({ webkit: type });
    const launched = await type.launchPersistentContext(root); const closing = launched.close();
    assert.equal(closed, true);
    await assert.rejects(acquireProfileLease(root), { code: 'profile_in_use' });
    finish(); await closing; assert.deepEqual(await readdir(root), []);
    const frozen = Object.freeze(fakeContext());
    const frozenType = { launchPersistentContext: async () => frozen }; installProfileGuard({ chromium: frozenType });
    await assert.rejects(frozenType.launchPersistentContext(root), TypeError);
    assert.equal(frozen.isClosed(), true); assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
