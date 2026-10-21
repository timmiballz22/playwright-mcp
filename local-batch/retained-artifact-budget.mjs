// Trusted host policy. Durable jobs serialize execution with their project lease.
// This bounds retained logical bytes, not temporary browser data or OS allocation.
import { lstat, opendir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { validateScreenshotLimit } from './screenshot-budget.mjs';
export const DEFAULT_RETAINED_ARTIFACT_BYTES = 536870912;
export function validateRetainedArtifactLimit(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1073741824) throw new TypeError('Invalid retained artifact byte limit');
  return value;
}
export function parseRetainedArtifactLimit(value) {
  if (value === undefined) return DEFAULT_RETAINED_ARTIFACT_BYTES;
  if (typeof value !== 'string' || !/^\d{1,10}$/.test(value)) throw new TypeError('Invalid retained artifact byte limit');
  return validateRetainedArtifactLimit(Number(value));
}
const failure = () => Object.assign(new Error('Retained artifact admission denied'), { code: 'ARTIFACT_STORAGE_LIMIT' });
export async function checkRetainedArtifactBudget(base, limit, screenshotLimit) {
  validateRetainedArtifactLimit(limit);
  // Full pretty-printed report cap plus fixed supervisor cleanup diagnostics.
  const reserve = validateScreenshotLimit(screenshotLimit) + 8388608 + 16384;
  if (reserve > limit) throw failure();
  const absolute = path.resolve(base);
  let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let entry = await lstat(current);
    if (entry.isSymbolicLink()) {
      // Immutable macOS system aliases are legitimate host temp paths. No
      // user-selected link/junction gains permission to redirect inventory.
      if (process.platform !== 'darwin' || !['/var', '/tmp', '/etc'].includes(current) || entry.uid !== 0) throw failure();
      const resolved = await realpath(current); const parent = await lstat('/private');
      if (resolved !== '/private' + current || !parent.isDirectory() || parent.uid !== 0 || parent.mode & 0o022) throw failure();
      current = resolved; entry = await lstat(current);
    }
    if (!entry.isDirectory()) throw failure();
  }
  // Ordinary Windows short-name/case aliases are not links. Canonicalize after
  // checking each original component, inside the supervised worker deadline.
  base = await realpath(current);
  let bytes = 0; let entries = 0;
  async function visit(location, depth) {
    if (++entries > 10000 || depth > 8) throw failure();
    const entry = await lstat(location);
    if (entry.isSymbolicLink() || !entry.isDirectory() && !entry.isFile() ||
        typeof process.getuid === 'function' && entry.uid !== process.getuid()) throw failure();
    if (entry.isDirectory()) {
      for await (const item of await opendir(location)) await visit(path.join(location, item.name), depth + 1);
    } else {
      if (entry.nlink !== 1 || !Number.isSafeInteger(entry.size) || entry.size < 0) throw failure();
      bytes += entry.size;
      if (!Number.isSafeInteger(bytes) || bytes > limit - reserve) throw failure();
    }
  }
  await visit(base, 0);
  return { bytes, reserve };
}
