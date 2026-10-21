// Cross-process ownership for delegated persistent profiles. No PID from disk
// authorizes killing or stale deletion. Unknown shutdown always retains the lease.
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const held = new Map();
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
function profileError(code) {
  const message = code === 'profile_in_use' ? 'Profile is already in use by another local owner' :
    code === 'profile_cleanup_unknown' ? 'Profile cleanup could not be confirmed' : 'Persistent profile is unavailable';
  return Object.assign(new Error(message + ' (' + code + ')'), { code });
}
function privateEntry(entry, directory) {
  if (entry.isSymbolicLink() || !(directory ? entry.isDirectory() : entry.isFile()) || !directory && entry.nlink !== 1n) throw profileError('profile_cleanup_unknown');
  if (typeof process.getuid === 'function' && (entry.uid !== BigInt(process.getuid()) || entry.mode & 0o077n)) throw profileError('profile_cleanup_unknown');
}
async function readOwner(directory) {
  privateEntry(await fs.lstat(directory, { bigint: true }), true);
  const filename = path.join(directory, 'owner.json');
  const file = await fs.open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
  try {
    const entry = await file.stat({ bigint: true }); privateEntry(entry, false);
    if (entry.size > 2048n) throw profileError('profile_cleanup_unknown');
    const bytes = Buffer.alloc(2049); let used = 0;
    while (used < bytes.length) { const { bytesRead } = await file.read(bytes, used, bytes.length - used, null); if (!bytesRead) break; used += bytesRead; }
    if (used > 2048) throw profileError('profile_cleanup_unknown');
    const owner = JSON.parse(bytes.subarray(0, used).toString());
    if (!owner || Object.keys(owner).sort().join(',') !== 'pid,token,version' || owner.version !== 1 || !Number.isSafeInteger(owner.pid) || owner.pid < 1 || owner.pid > 2147483647 || !uuid.test(owner.token)) throw profileError('profile_cleanup_unknown');
    return owner;
  } finally { await file.close(); }
}
async function acquireProfileLease(profile) {
  if (typeof profile !== 'string' || !profile.length) throw profileError('profile_unavailable');
  let root;
  try {
    const absolute = path.resolve(profile);
    if (absolute === path.parse(absolute).root) throw new Error();
    await fs.mkdir(path.resolve(profile), { recursive: true, mode: 0o700 });
    root = await fs.realpath(path.resolve(profile));
    if (root === path.parse(root).root) throw new Error();
    const entry = await fs.lstat(root, { bigint: true });
    if (!entry.isDirectory() || typeof process.getuid === 'function' && (entry.uid !== BigInt(process.getuid()) || entry.mode & 0o022n)) throw new Error();
  } catch { throw profileError('profile_unavailable'); }
  if (held.has(root)) throw profileError(held.get(root).uncertain ? 'profile_cleanup_unknown' : 'profile_in_use');
  const directory = path.join(root, '.playwright-mcp-owner');
  try { await fs.mkdir(directory, { mode: 0o700 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw profileError('profile_unavailable');
    let owner;
    try { owner = await readOwner(directory); } catch { throw profileError('profile_cleanup_unknown'); }
    try { process.kill(owner.pid, 0); } catch (error) { if (error.code === 'ESRCH') throw profileError('profile_cleanup_unknown'); }
    throw profileError('profile_in_use');
  }
  const record = { token: randomUUID(), uncertain: false }; held.set(root, record);
  let identity;
  try {
    identity = await fs.lstat(directory, { bigint: true }); privateEntry(identity, true);
    const file = await fs.open(path.join(directory, 'owner.json'), 'wx', 0o600);
    try { await file.writeFile(JSON.stringify({ version: 1, pid: process.pid, token: record.token })); await file.sync(); }
    finally { await file.close(); }
  } catch { record.uncertain = true; throw profileError('profile_cleanup_unknown'); }
  let released = false; let releasing;
  const lease = {
    get released() { return released; },
    markUncertain() { record.uncertain = true; },
    release() {
      if (!releasing) releasing = (async () => {
        try {
          const current = await fs.lstat(directory, { bigint: true }); privateEntry(current, true);
          const owner = await readOwner(directory);
          if (current.dev !== identity.dev || current.ino !== identity.ino || owner.pid !== process.pid || owner.token !== record.token) throw new Error();
          const entries = await fs.opendir(directory); let count = 0;
          try { for await (const entry of entries) { if (++count > 1 || entry.name !== 'owner.json') throw new Error(); } }
          finally { await entries.close().catch(() => {}); }
          if (count !== 1) throw new Error();
          await fs.unlink(path.join(directory, 'owner.json')); await fs.rmdir(directory);
          if (held.get(root) === record) held.delete(root);
          released = true; return true;
        } catch { record.uncertain = true; throw profileError('profile_cleanup_unknown'); }
      })();
      return releasing;
    },
  };
  return lease;
}
module.exports = { acquireProfileLease, profileError };
