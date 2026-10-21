import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, chmod, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { resolveJobConfig } from './config.mjs';
test('operator owner/project namespaces are stable, private and independent of tool data', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jobs-config-'));
  try {
    const project = path.join(root, 'project'); await mkdir(project);
    const second = path.join(root, 'other'); await mkdir(second);
    const env = { PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'data'), PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: 'http://127.0.0.1:8123' };
    const a = await resolveJobConfig({ env, cwd: project });
    const b = await resolveJobConfig({ env, cwd: project });
    assert.equal(a.journal.projectId, b.journal.projectId);
    assert.equal(a.journal.directory, b.journal.directory);
    const otherOwner = await resolveJobConfig({ env: { ...env, PLAYWRIGHT_JOBS_OWNER_ID: randomUUID() }, cwd: project });
    assert.equal(otherOwner.journal.directory, a.journal.directory);
    assert.notEqual(otherOwner.execution.artifactsDir, a.execution.artifactsDir);
    const otherProject = await resolveJobConfig({ env, cwd: second });
    assert.notEqual(otherProject.journal.directory, a.journal.directory);
    assert.equal(a.execution.readOnly, true);
    assert.equal(a.execution.maxScreenshotBytes, 16777216);
    assert.equal(a.execution.allowSensitiveArtifacts, false);
    assert.deepEqual(a.execution.allowedOrigins, ['http://127.0.0.1:8123']);
  } finally { await rm(root, { recursive: true, force: true }); }
});
if (process.platform !== 'win32') test('untrusted symlinks and writable ancestors cannot redirect job storage writes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jobs-config-links-'));
  try {
    const outside = path.join(root, 'outside'); await mkdir(outside); await writeFile(path.join(outside, 'marker'), 'unchanged');
    const link = path.join(root, 'alias'); await symlink(outside, link);
    const env = { PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_DATA_DIR: path.join(link, 'child') };
    await assert.rejects(resolveJobConfig({ env, cwd: root }), { code: 'unsafe_storage' });
    assert.deepEqual(await readdir(outside), ['marker']);
    const shared = path.join(root, 'shared'); await mkdir(shared); await chmod(shared, 0o777);
    await assert.rejects(resolveJobConfig({ env: { ...env, PLAYWRIGHT_JOBS_DATA_DIR: path.join(shared, 'child') }, cwd: root }), { code: 'unsafe_storage' });
    assert.deepEqual(await readdir(shared), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('invalid owner/policy config is rejected before any storage creation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jobs-config-input-'));
  try {
    const base = { PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'data') };
    for (const patch of [{ PLAYWRIGHT_JOBS_MAX_SCREENSHOT_BYTES: '268435457' }, { PLAYWRIGHT_JOBS_DATA_DIR: '' }, { PLAYWRIGHT_JOBS_OWNER_ID: '' }, { PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: 'http://user:secret@localhost/' }, { PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: 'file:///tmp' }, { PLAYWRIGHT_JOBS_ALLOW_MUTATIONS: 'maybe' }, { PLAYWRIGHT_JOBS_NAVIGATION_RETRIES: '3' }])
      await assert.rejects(resolveJobConfig({ env: { ...base, ...patch }, cwd: root }));
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
if (process.platform === 'win32') test('Windows configuration rejects a junction before writing outside its private namespace', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jobs-config-junction-'));
  try {
    const outside = path.join(root, 'outside'); await mkdir(outside); await writeFile(path.join(outside, 'marker'), 'unchanged');
    const alias = path.join(root, 'alias'); await symlink(outside, alias, 'junction');
    await assert.rejects(resolveJobConfig({ cwd: root, env: { PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_DATA_DIR: path.join(alias, 'child') } }), { code: 'unsafe_storage' });
    assert.deepEqual(await readdir(outside), ['marker']);
  } finally { await rm(root, { recursive: true, force: true }); }
});
