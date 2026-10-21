// Native owner/System ACL storage. Independent native helper tests pass;
// public configuration integration has separate acceptance coverage.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const execute = promisify(execFile);
const fail = code => { throw Object.assign(new Error(code), { code }); };
export async function prepareWindowsJobDirectories({ base, projectRoot, ownerHash } = {}) {
  if (process.platform !== 'win32') fail('unsupported_private_storage');
  if (typeof base !== 'string' || !base.length || base.length > 4096 || base.includes('\0') ||
      !/^[A-Za-z]:[\\/]/.test(base) || typeof projectRoot !== 'string' || !projectRoot.length || projectRoot.length > 4096 || projectRoot.includes('\0') || typeof ownerHash !== 'string' || !/^[0-9a-f]{64}$/.test(ownerHash)) fail('unsafe_storage');
  const script = await readFile(new URL('./private-windows.ps1', import.meta.url), 'utf8');
  const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  let stdout;
  try {
    ({ stdout } = await execute(executable, ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 10000, maxBuffer: 65536, windowsHide: true, env: {
      ...process.env, PLAYWRIGHT_PRIVATE_BASE: path.resolve(base), PLAYWRIGHT_PRIVATE_PROJECT: projectRoot, PLAYWRIGHT_PRIVATE_OWNER_HASH: ownerHash,
    } }));
  } catch (error) {
    try { if (JSON.parse(error.stdout).code === 'unsafe_storage') fail('unsafe_storage'); }
    catch (parsed) { if (parsed.code === 'unsafe_storage') throw parsed; }
    fail('private_storage_unavailable');
  }
  let value;
  try { value = JSON.parse(stdout); } catch { fail('private_storage_unavailable'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.ownerSid !== 'string') fail('unsafe_storage');
  const expected = createHash('sha256').update(value.ownerSid + ':' + projectRoot).digest('hex');
  if (value.ok !== true || !/^S-1-[0-9-]+$/.test(value.ownerSid ?? '') || value.projectId !== expected || typeof value.directory !== 'string' || typeof value.artifactsDir !== 'string') fail('unsafe_storage');
  const canonicalBase = await realpath(base);
  const directory = await realpath(value.directory); const artifactsDir = await realpath(value.artifactsDir);
  const project = path.join(canonicalBase, 'projects', value.projectId);
  if (path.relative(path.join(project, 'journal'), directory) || path.relative(path.join(project, 'artifacts', ownerHash), artifactsDir)) fail('unsafe_storage');
  return { ownerSid: value.ownerSid, projectId: value.projectId, directory, artifactsDir };
}
