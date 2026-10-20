import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, stat, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cleanupTemporaryDirectory } from './cleanup.mjs';

test('temporary cleanup completes in a separate process and reports a startup deadline', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cleanup-process-'));
  const dir = path.join(root, 'tmp');
  const { mkdir } = await import('node:fs/promises');
  try {
    await mkdir(dir); await writeFile(path.join(dir, 'profile'), 'fixture');
    assert.equal(await cleanupTemporaryDirectory(dir), true);
    await assert.rejects(stat(dir), { code: 'ENOENT' });
    await mkdir(dir); await writeFile(path.join(dir, 'profile'), 'fixture');
    const start = performance.now();
    assert.equal(await cleanupTemporaryDirectory(dir, 1), false);
    assert.ok(performance.now() - start < 3000);
    // The expired child has exited before this API returns, so it cannot delete
    // a directory later after the caller has observed cleanup failure.
    assert.equal((await stat(dir)).isDirectory(), true);
  } finally { await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});
