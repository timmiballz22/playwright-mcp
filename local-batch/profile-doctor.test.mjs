import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink, chmod, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
const { acquireProfileLease, inspectProfileLease } = createRequire(import.meta.url)('./profile-lease.cjs');
const cli = fileURLToPath(new URL('../cli.js', import.meta.url));
const invoke = args => {
  const result = spawnSync(process.execPath, [cli, 'profile-doctor', ...args], { encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error); assert.equal(result.stderr, '');
  return { status: result.status, value: JSON.parse(result.stdout), text: result.stdout };
};
test('profile doctor reports a missing path without creating it', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'profile-doctor-'));
  try {
    const missing = path.join(root, 'not-created');
    const reply = invoke([missing]); assert.equal(reply.status, 0);
    assert.deepEqual(reply.value, { ok: true, profile: 'missing', guardLock: 'absent', identityVerified: false });
    assert.equal(reply.text.includes(missing), false);
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('profile doctor preserves active ownership and hides path, PID and token from CLI output', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'profile-doctor-owned-')); let lease;
  try {
    const credentialFile = path.join(root, 'Cookies');
    await writeFile(credentialFile, 'fake-unread-credential-canary', { mode: 0o600 });
    if (typeof process.getuid === 'function') await chmod(credentialFile, 0o000);
    lease = await acquireProfileLease(root);
    const filename = path.join(root, '.playwright-mcp-owner', 'owner.json'); const before = await readFile(filename, 'utf8');
    const owner = JSON.parse(before);
    assert.equal((await inspectProfileLease(root)).identityVerified, false);
    const reply = invoke([root]);
    assert.equal(reply.status, 1); assert.equal(reply.value.code, 'profile_in_use');
    assert.equal(reply.value.recordedProcess, 'present'); assert.equal(reply.value.identityVerified, false);
    for (const privateValue of [root, owner.token, String(owner.pid), 'fake-unread-credential-canary']) assert.equal(reply.text.includes(privateValue), false);
    assert.equal(await readFile(filename, 'utf8'), before);
    if (typeof process.getuid === 'function') { assert.equal((await stat(credentialFile)).mode & 0o777, 0); await chmod(credentialFile, 0o600); }
    assert.equal(await readFile(credentialFile, 'utf8'), 'fake-unread-credential-canary');
    await assert.rejects(acquireProfileLease(root), { code: 'profile_in_use' });
    await lease.release(); lease = undefined;
    assert.equal(invoke([root]).value.guardLock, 'absent');
  } finally { if (lease) await lease.release(); await rm(root, { recursive: true, force: true }); }
});
test('profile doctor retains malformed, oversized and linked guard metadata without leaking contents', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'profile-doctor-invalid-'));
  try {
    const profile = path.join(root, 'profile'); await mkdir(profile, { mode: 0o700 });
    const guard = path.join(profile, '.playwright-mcp-owner'); await mkdir(guard, { mode: 0o700 });
    const filename = path.join(guard, 'owner.json');
    for (const data of ['fake-private-doctor-canary', 'fake-private-doctor-canary'.repeat(200)]) {
      await writeFile(filename, data, { mode: 0o600 });
      const reply = invoke([profile]);
      assert.equal(reply.status, 1); assert.equal(reply.value.code, 'profile_cleanup_unknown');
      assert.equal(reply.value.guardLock, 'unreadable'); assert.equal(reply.text.includes('fake-private-doctor-canary'), false);
      assert.equal(await readFile(filename, 'utf8'), data);
    }
    await rm(guard, { recursive: true });
    const outside = path.join(root, 'outside'); await mkdir(outside, { mode: 0o700 });
    const marker = path.join(outside, 'owner.json'); await writeFile(marker, 'fake-outside-canary', { mode: 0o600 });
    await symlink(outside, guard, process.platform === 'win32' ? 'junction' : 'dir');
    const reply = invoke([profile]); assert.equal(reply.value.guardLock, 'unreadable');
    assert.equal(reply.text.includes('fake-outside-canary'), false); assert.equal(await readFile(marker, 'utf8'), 'fake-outside-canary');
  } finally { await rm(root, { recursive: true, force: true }); }
});
if (typeof process.getuid === 'function') test('profile doctor does not repair a writable profile directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'profile-doctor-mode-'));
  try {
    await chmod(root, 0o777);
    assert.deepEqual(await inspectProfileLease(root), { ok: false, code: 'profile_unavailable' });
    assert.equal((await stat(root)).mode & 0o777, 0o777);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('profile doctor rejects extra CLI actions without accepting a reset request', () => {
  for (const args of [[], ['--reset'], ['fake-path', '--reset']]) {
    const reply = invoke(args);
    assert.equal(reply.status, 2); assert.deepEqual(reply.value, { ok: false, code: 'invalid_arguments' });
  }
});
