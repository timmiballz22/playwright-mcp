import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink, rm, realpath } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { cleanupJobArtifacts } from './artifact-cleanup.mjs';
test('bounded artifact cleanup previews, removes only one scope and is idempotent', async () => {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'job-cleanup-')));
  const runId = randomUUID(); const scope = path.join(base, 'exec-' + runId);
  try {
    await mkdir(path.join(scope, 'run-private'), { recursive: true, mode: 0o700 });
    await writeFile(path.join(scope, 'run-private', 'step.png'), 'fake-private');
    await writeFile(path.join(base, 'unrelated'), 'keep');
    const preview = await cleanupJobArtifacts({ base, runId });
    assert.equal(preview.dryRun, true); assert.equal(preview.files, 1); assert.equal(preview.bytes, 12);
    assert.equal(await readFile(path.join(scope, 'run-private', 'step.png'), 'utf8'), 'fake-private');
    const result = await cleanupJobArtifacts({ base, runId, dryRun: false });
    assert.equal(result.removed, true); assert.deepEqual(await readdir(base), ['unrelated']);
    assert.equal((await cleanupJobArtifacts({ base, runId, dryRun: false })).alreadyAbsent, true);
    assert.equal(await readFile(path.join(base, 'unrelated'), 'utf8'), 'keep');
    await assert.rejects(cleanupJobArtifacts({ base, runId: '../escape' }));
  } finally { await rm(base, { recursive: true, force: true }); }
});
if (process.platform !== 'win32') test('linked entries and oversized trees reject before deleting any artifact', async () => {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'job-cleanup-')));
  const runId = randomUUID(); const scope = path.join(base, 'exec-' + runId);
  try {
    await mkdir(scope); await writeFile(path.join(base, 'marker'), 'keep');
    await writeFile(path.join(scope, 'first'), 'keep');
    await symlink(path.join(base, 'marker'), path.join(scope, 'link'));
    await assert.rejects(cleanupJobArtifacts({ base, runId, dryRun: false }), { code: 'unsafe_artifacts' });
    assert.equal(await readFile(path.join(scope, 'first'), 'utf8'), 'keep');
    assert.equal(await readFile(path.join(base, 'marker'), 'utf8'), 'keep');
    await rm(path.join(scope, 'link'));
    await assert.rejects(cleanupJobArtifacts({ base, runId, dryRun: false, maxBytes: 2 }), { code: 'cleanup_limit' });
    assert.equal(await readFile(path.join(scope, 'first'), 'utf8'), 'keep');
    await writeFile(path.join(scope, 'second'), 'keep');
    await assert.rejects(cleanupJobArtifacts({ base, runId, dryRun: false, maxEntries: 1 }), { code: 'cleanup_limit' });
    assert.equal(await readFile(path.join(scope, 'first'), 'utf8'), 'keep');
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('controller rejects active, uncertain and expired-result cleanup before filesystem access', async () => {
  const { JobController } = await import('./controller.mjs');
  for (const [row, code] of [
    [{ state: 'RUNNING' }, 'not_terminal'],
    [{ state: 'FAILED', operatorAttentionRequired: true }, 'cleanup_blocked'],
    [{ state: 'FAILED', resultAvailable: false, completed: 0, completionCertainty: 'confirmed_lower_bound' }, 'cleanup_blocked'],
  ]) {
    let calls = 0;
    const controller = new JobController({ call: async command => { calls++; assert.equal(command, 'read'); return row; } }, {}, { artifactsDir: '/must-not-be-read' });
    await assert.rejects(controller.cleanup(randomUUID(), false), { code });
    assert.equal(calls, 1);
  }
});
