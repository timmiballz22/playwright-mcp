import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, realpath, rm, symlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { prepareWindowsJobDirectories } from './private-windows.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
async function inspect(directory, widen = false) {
  const script = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);$ErrorActionPreference='Stop';$p=$env:OWNED_ACL_FIXTURE;$directory=([IO.File]::GetAttributes($p) -band [IO.FileAttributes]::Directory) -ne 0;$a=if($directory){[IO.Directory]::GetAccessControl($p)}else{[IO.File]::GetAccessControl($p)};
  if($env:OWNED_ACL_WIDEN -eq '1'){$r=[Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-5-32-545'),[Security.AccessControl.FileSystemRights]::ReadAndExecute,[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit',[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow);$a.AddAccessRule($r);[IO.Directory]::SetAccessControl($p,$a);$a=[IO.Directory]::GetAccessControl($p)};
  $rules=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])|ForEach-Object{@{sid=$_.IdentityReference.Value;type=$_.AccessControlType.ToString()}});
  [Console]::WriteLine((@{owner=$a.GetOwner([Security.Principal.SecurityIdentifier]).Value;protected=$a.AreAccessRulesProtected;rules=$rules;sddl=$a.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All)}|ConvertTo-Json -Compress -Depth 5))`;
  const { stdout } = await promisify(execFile)(powershell, ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 10000, maxBuffer: 65536, windowsHide: true, env: { ...process.env, OWNED_ACL_FIXTURE: directory, OWNED_ACL_WIDEN: widen ? '1' : '0' } });
  return JSON.parse(stdout);
}
if (process.platform !== 'win32') test('Windows ACL helper rejects a non-Windows host without creating storage', async () => {
  await assert.rejects(prepareWindowsJobDirectories({}), { code: 'unsupported_private_storage' });
});
else {
  test('native Windows storage is protected for current SID/System and namespace remains stable across owners', { timeout: 30000 }, async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'jobs-acl-')));
    try {
      const base = path.join(root, 'state'); const projectRoot = root; const ownerHash = hash(randomUUID());
      const first = await prepareWindowsJobDirectories({ base, projectRoot, ownerHash });
      assert.equal(first.projectId, hash(first.ownerSid + ':' + projectRoot));
      const second = await prepareWindowsJobDirectories({ base, projectRoot, ownerHash: hash(randomUUID()) });
      assert.equal(second.directory, first.directory); assert.notEqual(second.artifactsDir, first.artifactsDir);
      for (const directory of [base, first.directory, first.artifactsDir]) {
        const acl = await inspect(directory);
        assert.ok(acl.owner === first.ownerSid, 'Private owner must match process SID'); assert.equal(acl.protected, true);
        assert.ok(acl.rules.length >= 1); assert.ok(acl.rules.every(rule => [first.ownerSid, 'S-1-5-18'].includes(rule.sid) && rule.type === 'Allow'), 'Only owner/System may be allowed');
      }
      const marker = path.join(first.directory, 'marker'); await writeFile(marker, 'keep');
      const fileAcl = await inspect(marker);
      assert.ok(fileAcl.rules.every(rule => [first.ownerSid, 'S-1-5-18'].includes(rule.sid) && rule.type === 'Allow'), 'Created files must inherit only private owner/System grants');
      assert.equal((await prepareWindowsJobDirectories({ base, projectRoot, ownerHash })).directory, first.directory);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  test('unsafe existing ACLs and junctions fail closed without modifying outside state', { timeout: 30000 }, async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'jobs-acl-negative-')));
    try {
      const base = path.join(root, 'state'); const input = { base, projectRoot: root, ownerHash: hash(randomUUID()) };
      await prepareWindowsJobDirectories(input);
      const widened = await inspect(base, true);
      await assert.rejects(prepareWindowsJobDirectories(input), { code: 'unsafe_storage' });
      assert.ok((await inspect(base)).sddl === widened.sddl, 'Existing unsafe ACL must not be repaired');
      const outside = path.join(root, 'outside'); await mkdir(outside); await writeFile(path.join(outside, 'marker'), 'keep');
      const alias = path.join(root, 'alias'); await symlink(outside, alias, 'junction');
      await assert.rejects(prepareWindowsJobDirectories({ ...input, base: path.join(alias, 'child') }), { code: 'unsafe_storage' });
      assert.deepEqual(await readdir(outside), ['marker']);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}
