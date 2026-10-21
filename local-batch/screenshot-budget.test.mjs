import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile, stat, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ScreenshotBudget, parseScreenshotLimit } from './screenshot-budget.mjs';
test('screenshot budget refuses excess before writes and publishes complete private files without overwriting', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'screenshot-budget-'));
  const budget = new ScreenshotBudget(5);
  const page = { screenshot: async options => { assert.equal(options.path, undefined); assert.equal(options.fullPage, false); return Buffer.from('123'); } };
  try {
    const first = path.join(directory, 'first.png');
    await budget.publish(page, first);
    assert.equal(await readFile(first, 'utf8'), '123'); assert.equal(budget.used, 3);
    if (process.platform !== 'win32') assert.equal((await stat(first)).mode & 0o777, 0o600);
    await assert.rejects(budget.publish(page, path.join(directory, 'second.png')), { code: 'SCREENSHOT_BYTE_LIMIT' });
    assert.deepEqual(await readdir(directory), ['first.png']);
    const collision = path.join(directory, 'existing.png'); await writeFile(collision, 'keep');
    await assert.rejects(new ScreenshotBudget(10).publish(page, collision), { code: 'ARTIFACT_COLLISION' });
    assert.equal(await readFile(collision, 'utf8'), 'keep');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('cancellation after image capture cannot publish a late screenshot or leave a temporary file', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'screenshot-cancel-'));
  let allowed = true;
  try {
    await assert.rejects(new ScreenshotBudget(100).publish({ screenshot: async () => { allowed = false; return Buffer.from('fake-private-image'); } }, path.join(directory, 'late.png'), { canPublish: () => allowed }), { code: 'ARTIFACT_CANCELLED' });
    assert.deepEqual(await readdir(directory), []);
    assert.equal(parseScreenshotLimit(undefined), 16777216);
    for (const value of ['', '-1', '268435457', '1.5', 'Infinity', 'fake-secret-canary']) assert.throws(() => parseScreenshotLimit(value), TypeError);
    assert.equal(parseScreenshotLimit('0'), 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
