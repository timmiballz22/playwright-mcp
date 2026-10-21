import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
const require = createRequire(import.meta.url);
const { acquireProfileLease, inspectProfileLease } = require('./profile-lease.cjs');
test('profile lease refuses contention across aliases and releases only its own complete metadata', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'profile-lease-'));
  try {
    const profile = path.join(root, 'profile');
    const lease = await acquireProfileLease(profile);
    const alias = path.join(root, 'alias'); await symlink(profile, alias, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(acquireProfileLease(alias), { code: 'profile_in_use' });
    assert.equal(await lease.release(), true); assert.equal(await lease.release(), true);
    const second = await acquireProfileLease(profile); await second.release();
    assert.deepEqual(await readdir(profile), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('profile lease never deletes malformed or changed ownership records', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'profile-lease-corrupt-'));
  try {
    const lease = await acquireProfileLease(root);
    const directory = path.join(root, '.playwright-mcp-owner'); const filename = path.join(directory, 'owner.json');
    const owner = JSON.parse(await readFile(filename, 'utf8'));
    await writeFile(filename, JSON.stringify({ ...owner, token: randomUUID() }));
    await assert.rejects(lease.release(), { code: 'profile_cleanup_unknown' });
    assert.deepEqual(await readdir(directory), ['owner.json']);
    await writeFile(filename, 'broken');
    await assert.rejects(acquireProfileLease(root), { code: 'profile_cleanup_unknown' });
    assert.equal(await readFile(filename, 'utf8'), 'broken');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('another process owns the lease; dead owner remains uncertain and is never silently reclaimed', { timeout: 10000 }, async () => {
  const { spawn } = await import('node:child_process'); const { once } = await import('node:events');
  const { fileURLToPath } = await import('node:url');
  const root = await mkdtemp(path.join(os.tmpdir(), 'profile-lease-owner-'));
  const program = "require(process.argv[1]).acquireProfileLease(process.argv[2]).then(()=>{process.stdout.write('held\\n');setInterval(()=>{},1000)}).catch(()=>process.exit(1))";
  const child = spawn(process.execPath, ['-e', program, fileURLToPath(new URL('./profile-lease.cjs', import.meta.url)), root], { stdio: ['ignore', 'pipe', 'ignore'] });
  const exited = once(child, 'close'); let timer;
  try {
    await Promise.race([once(child.stdout, 'data'), exited.then(() => { throw new Error('Fixture exited before lease'); }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Fixture lease timeout')), 5000); })]);
    clearTimeout(timer);
    await assert.rejects(acquireProfileLease(root), { code: 'profile_in_use' });
    child.kill('SIGKILL'); await exited;
    const diagnosis = await inspectProfileLease(root);
    assert.equal(diagnosis.recordedProcess, 'absent'); assert.equal(diagnosis.identityVerified, false);
    assert.equal(diagnosis.code, 'profile_cleanup_unknown');
    await assert.rejects(acquireProfileLease(root), { code: 'profile_cleanup_unknown' });
    assert.deepEqual(await readdir(path.join(root, '.playwright-mcp-owner')), ['owner.json']);
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; }
    await rm(root, { recursive: true, force: true });
  }
});

test('linked ownership directory cannot change or delete an outside marker', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'profile-lease-link-'));
  const { mkdir } = await import('node:fs/promises');
  try {
    const profile = path.join(root, 'profile'); const outside = path.join(root, 'outside');
    await mkdir(profile); await mkdir(outside); await writeFile(path.join(outside, 'marker'), 'keep');
    await symlink(outside, path.join(profile, '.playwright-mcp-owner'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(acquireProfileLease(profile), { code: 'profile_cleanup_unknown' });
    assert.equal(await readFile(path.join(outside, 'marker'), 'utf8'), 'keep');
    assert.deepEqual(await readdir(outside), ['marker']);
  } finally { await rm(root, { recursive: true, force: true }); }
});
