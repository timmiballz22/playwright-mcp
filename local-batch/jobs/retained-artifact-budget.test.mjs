import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, writeFile, readFile, symlink, link, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { checkRetainedArtifactBudget, validateRetainedArtifactLimit } from '../retained-artifact-budget.mjs';
import { executeWorkflow } from '../executor.mjs';
import { JobController } from './controller.mjs';
import { ownedDescendants } from '../fixtures/process-audit.mjs';
import { supportsJournal } from './journal.mjs';
const reserve = 8388608 + 16384;
async function fixture(body) {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'retained-budget-')));
  try { await body(base); } finally { await rm(base, { recursive: true, force: true }); }
}
test('retained admission accepts the exact reserved boundary and preserves prior bytes when full', async () => fixture(async base => {
  const marker = path.join(base, 'prior'); await writeFile(marker, 'prior');
  assert.deepEqual(await checkRetainedArtifactBudget(base, reserve + 5, 0), { bytes: 5, reserve });
  await assert.rejects(checkRetainedArtifactBudget(base, reserve + 4, 0), { code: 'ARTIFACT_STORAGE_LIMIT' });
  assert.equal(await readFile(marker, 'utf8'), 'prior');
}));
for (const kind of ['symbolic', 'hard', 'depth']) test(`retained admission rejects ${kind} entries without mutation`, async () => fixture(async base => {
  const marker = path.join(base, 'prior'); await writeFile(marker, 'prior');
  if (kind === 'symbolic') await symlink(base, path.join(base, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  else if (kind === 'hard') await link(marker, path.join(base, 'alias'));
  else await mkdir(path.join(base, ...Array(9).fill('deep')), { recursive: true });
  await assert.rejects(checkRetainedArtifactBudget(base, reserve + 100, 0), { code: 'ARTIFACT_STORAGE_LIMIT' });
  assert.equal(await readFile(marker, 'utf8'), 'prior');
}));
test('retained limit rejects malformed trusted configuration', () => {
  for (const value of [undefined, 0, -1, NaN, Infinity, 1.5, '100', 1073741825]) assert.throws(() => validateRetainedArtifactLimit(value));
});
test('real supervised admission denies before browser launch and preserves prior artifacts', { timeout: 15000 }, async () => fixture(async base => {
  await writeFile(path.join(base, 'prior'), 'prior'); const events = [];
  const result = await executeWorkflow({ steps: [{ type: 'waitFor', selector: 'body' }] }, {
    artifactsDir: base, maxScreenshotBytes: 0, maxRetainedArtifactBytes: reserve + 4, onEvent: event => events.push(event),
  });
  assert.equal(result.ok, false); assert.equal(result.stage, 'workspace'); assert.equal(result.reason, 'resource_limit'); assert.equal(result.completed, 0);
  assert.equal(result.execution.cleanup, 'terminated'); assert.equal(events.some(e => e.type === 'ownedProcess'), false);
  assert.equal(await readFile(path.join(base, 'prior'), 'utf8'), 'prior');
}));
if (supportsJournal) test('durable quota failure remains deduplicated and a later admitted job executes', { timeout: 30000 }, async () => fixture(async base => {
  const artifactsDir = path.join(base, 'artifacts'); await mkdir(artifactsDir, { mode: 0o700 });
  const marker = path.join(artifactsDir, 'prior'); await writeFile(marker, 'prior');
  const controller = await JobController.open({ journal: { directory: path.join(base, 'journal'), ownerId: randomUUID(), projectId: 'a'.repeat(64) },
    execution: { artifactsDir, maxScreenshotBytes: 0, maxRetainedArtifactBytes: reserve + 4 } });
  const workflow = { steps: [{ type: 'waitFor', selector: 'body' }] }; const key = randomUUID();
  try {
    const started = await controller.start(workflow, key);
    const wait = async id => {
      for (let i = 0; i < 200; i++) { const row = await controller.status(id); if (['FAILED', 'SUCCEEDED'].includes(row.state)) return row; await new Promise(r => setTimeout(r, 25)); }
      assert.fail('Terminal job receipt missing');
    };
    const failed = await wait(started.jobId); assert.equal(failed.state, 'FAILED'); assert.equal(failed.completed, 0); assert.equal(failed.operatorAttentionRequired, false);
    assert.equal((await controller.start(workflow, key)).jobId, started.jobId);
    await rm(marker); // Explicit fixture-owner deletion; admission never prunes.
    const next = await controller.start(workflow, randomUUID()); assert.equal((await wait(next.jobId)).state, 'SUCCEEDED');
  } finally { await controller.close(); }
}));

test('a stalled retained scan stays inside the existing supervised workflow deadline', { timeout: 10000 }, async () => fixture(async base => {
  const owned = []; const events = []; const started = performance.now();
  const result = await executeWorkflow({ timeoutMs: 1500, steps: [{ type: 'waitFor', selector: 'body' }] }, {
    artifactsDir: base, maxScreenshotBytes: 0, maxRetainedArtifactBytes: reserve + 100,
    workerModule: new URL('./fixtures/retained-scan-stall.mjs', import.meta.url),
    onEvent(event) { events.push(event); if (event.pid) owned.push(event.pid); },
  });
  assert.equal(await readFile(path.join(base, 'scan-stalled'), 'utf8'), 'pending');
  assert.equal(result.reason, 'timeout'); assert.equal(result.completed, 0);
  assert.equal(result.execution.cleanup, 'terminated');
  assert.equal(events.some(event => event.type === 'ownedProcess'), false);
  assert.ok(performance.now() - started < 5000, 'Stalled scan escaped the supervised deadline and cleanup bounds');
  assert.deepEqual(await ownedDescendants(owned), []);
}));

test('retained inventory stops at its entry boundary and closes the directory iterator', async () => fixture(async base => {
  const originalStat = fs.lstat; const originalOpen = fs.opendir;
  let count = 9999; let observed = 0; let closed = false;
  fs.lstat = async location => path.dirname(location) === base && path.basename(location).startsWith('synthetic-') ?
    { uid: process.getuid?.(), size: 0, nlink: 1, isSymbolicLink: () => false, isDirectory: () => false, isFile: () => true } : originalStat(location);
  fs.opendir = async location => {
    if (location !== base) return originalOpen(location);
    return (async function* () { try { for (let i = 0; i < count; i++) { observed++; yield { name: 'synthetic-' + i }; } } finally { closed = true; } })();
  };
  syncBuiltinESMExports();
  try {
    await checkRetainedArtifactBudget(base, reserve, 0); assert.equal(observed, 9999); assert.equal(closed, true);
    count = 10001; observed = 0; closed = false;
    await assert.rejects(checkRetainedArtifactBudget(base, reserve, 0), { code: 'ARTIFACT_STORAGE_LIMIT' });
    assert.equal(observed, 10000); assert.equal(closed, true);
  } finally { fs.lstat = originalStat; fs.opendir = originalOpen; syncBuiltinESMExports(); }
}));
