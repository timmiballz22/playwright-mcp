// Terminal authorization belongs to the controller. Never accept a filesystem
// path or execution ID from public tool input. No recursive rm or link traversal.
import { lstat, realpath, opendir, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
const fail = code => { throw Object.assign(new Error(code), { code }); };
export async function cleanupJobArtifacts({ base, runId, dryRun = true, maxEntries = 2048, maxBytes = 536870912 }) {
  if (typeof base !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(runId ?? '') ||
      typeof dryRun !== 'boolean' || !Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > 2048 ||
      !Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > 536870912) fail('invalid_metadata');
  base = path.resolve(base);
  const root = path.join(base, 'exec-' + runId);
  const missing = () => ({ dryRun, files: 0, bytes: 0, removed: false, alreadyAbsent: true });
  try {
    const entry = await lstat(base);
    if (!entry.isDirectory() || entry.isSymbolicLink() || await realpath(base) !== base || typeof process.getuid === 'function' && (entry.uid !== process.getuid() || entry.mode & 0o077)) fail('unsafe_artifacts');
  } catch (error) { if (error.code === 'ENOENT') return missing(); throw error; }
  const files = []; const directories = []; let bytes = 0; let entries = 0;
  async function visit(location, depth) {
    if (++entries > maxEntries || depth > 8) fail('cleanup_limit');
    const entry = await lstat(location);
    if (depth === 0 && !entry.isDirectory() || entry.isSymbolicLink() || !entry.isDirectory() && !entry.isFile() ||
        typeof process.getuid === 'function' && entry.uid !== process.getuid()) fail('unsafe_artifacts');
    if (entry.isDirectory()) {
      directories.push(location);
      for await (const entry of await opendir(location)) await visit(path.join(location, entry.name), depth + 1);
    } else {
      if (entry.nlink !== 1) fail('unsafe_artifacts');
      bytes += entry.size; if (bytes > maxBytes) fail('cleanup_limit');
      files.push(location);
    }
  }
  try { await visit(root, 0); }
  catch (error) { if (error.code === 'ENOENT' && entries === 1) return missing(); throw error; }
  // Scan completely before mutation; limits or unsafe entries preserve all files.
  if (!dryRun) {
    for (const location of files) await unlink(location);
    for (const location of directories.reverse()) await rmdir(location);
  }
  return { dryRun, files: files.length, bytes, removed: !dryRun, alreadyAbsent: false };
}
