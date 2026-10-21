// Trusted operator configuration only. Never derive authorization from tool JSON.
import { lstat, mkdir, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { parseOrigins } from '../policy.mjs';
import { parseScreenshotLimit } from '../screenshot-budget.mjs';
import { navigationRetryPolicy } from '../navigation-retry.mjs';
export class JobConfigError extends Error {
  constructor(code) { super(code); this.name = 'JobConfigError'; this.code = code; }
}
const reject = code => { throw new JobConfigError(code); };
const hash = value => createHash('sha256').update(value).digest('hex');
function flag(env, name) {
  const value = env[name];
  if (value === undefined) return false;
  if (!['0', '1'].includes(value)) reject('invalid_policy');
  return value === '1';
}
async function privateDirectory(target) {
  const absolute = path.resolve(target);
  let current = path.parse(absolute).root;
  const parts = absolute.slice(current.length).split(path.sep).filter(Boolean);
  if (!parts.length) reject('unsafe_storage');
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    let entry;
    try { entry = await lstat(current); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try { await mkdir(current, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      entry = await lstat(current);
    }
    // macOS supplies these immutable system aliases even for normal temp paths.
    if (process.platform === 'darwin' && ['/var', '/tmp', '/etc'].includes(current) && entry.isSymbolicLink() && entry.uid === 0) {
      const resolved = await realpath(current);
      if (resolved !== '/private' + current) reject('unsafe_storage');
      const parent = await lstat('/private');
      if (!parent.isDirectory() || parent.uid !== 0 || parent.mode & 0o022) reject('unsafe_storage');
      current = resolved; entry = await lstat(current);
    }
    if (!entry.isDirectory() || entry.isSymbolicLink() || ![0, process.getuid()].includes(entry.uid)) reject('unsafe_storage');
    if ((entry.mode & 0o022) && !(entry.mode & 0o1000)) reject('unsafe_storage');
    if (index === parts.length - 1 && (entry.uid !== process.getuid() || entry.mode & 0o077)) reject('unsafe_storage');
  }
  return current;
}
export async function resolveJobConfig({ env = process.env, cwd = process.cwd() } = {}) {
  if (process.platform === 'win32' || typeof process.getuid !== 'function') reject('unsupported_private_storage');
  const ownerId = env.PLAYWRIGHT_JOBS_OWNER_ID;
  if (typeof ownerId !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(ownerId)) reject('invalid_owner');
  let allowedOrigins; let navigationRetry; let maxScreenshotBytes;
  const allowSensitiveArtifacts = flag(env, 'PLAYWRIGHT_JOBS_ALLOW_SENSITIVE_ARTIFACTS');
  const readOnly = !flag(env, 'PLAYWRIGHT_JOBS_ALLOW_MUTATIONS');
  try {
    maxScreenshotBytes = parseScreenshotLimit(env.PLAYWRIGHT_JOBS_MAX_SCREENSHOT_BYTES);
    const origins = (env.PLAYWRIGHT_JOBS_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
    if (origins.length > 64 || origins.some(value => value.length > 2048)) reject('invalid_policy');
    allowedOrigins = [...parseOrigins(origins)];
    const count = env.PLAYWRIGHT_JOBS_NAVIGATION_RETRIES;
    if (count !== undefined && !/^[0-2]$/.test(count)) reject('invalid_policy');
    navigationRetry = count === undefined ? undefined : navigationRetryPolicy({ maxRetries: Number(count) });
  } catch { reject('invalid_policy'); }
  const project = env.PLAYWRIGHT_JOBS_PROJECT_DIR ?? cwd;
  const providedBase = env.PLAYWRIGHT_JOBS_DATA_DIR;
  if (typeof project !== 'string' || project.length > 4096 || project.includes('\0') ||
      providedBase !== undefined && (typeof providedBase !== 'string' || !providedBase.length || providedBase.length > 4096 || providedBase.includes('\0'))) reject('invalid_storage');
  let projectRoot;
  try { projectRoot = await realpath(project); if (!(await lstat(projectRoot)).isDirectory()) reject('invalid_project'); }
  catch { reject('invalid_project'); }
  const projectId = hash(process.getuid() + ':' + projectRoot);
  const base = path.resolve(projectRoot, providedBase ?? path.join(os.homedir(), '.local', 'state', 'playwright-batch', 'jobs'));
  try {
    const canonicalBase = await privateDirectory(base);
    const projectStore = await privateDirectory(path.join(canonicalBase, 'projects', projectId));
    const directory = await privateDirectory(path.join(projectStore, 'journal'));
    const artifactsDir = await privateDirectory(path.join(projectStore, 'artifacts', hash(ownerId)));
    return { journal: { directory, projectId, ownerId }, execution: { allowedOrigins, artifactsDir, readOnly, allowSensitiveArtifacts, navigationRetry, maxScreenshotBytes } };
  } catch (error) {
    if (error instanceof JobConfigError) throw error;
    reject('storage_unavailable');
  }
}
