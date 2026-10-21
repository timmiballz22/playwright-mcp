// Read-only failure diagnostic. Reported numeric IDs are NOT kill authority or
// proof of identity; PID reuse can make this hint describe another process.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
async function queryStates(pids) {
  try { return (await exec('/bin/ps', ['-p', pids.join(','), '-o', 'pid=,stat='], { timeout: 1000, maxBuffer: 4096 })).stdout; }
  catch (error) { if (error.code === 1 && typeof error.stdout === 'string') return error.stdout; throw error; }
}
export async function reportedProcessStateHint(pids, { platform = process.platform, query = queryStates } = {}) {
  if (!['linux', 'darwin'].includes(platform)) return { coverage: 'not_collected' };
  if (!Array.isArray(pids) || !pids.length || pids.length > 16 || pids.some(pid => !Number.isSafeInteger(pid) || pid <= 1 || pid > 2147483647)) return { coverage: 'invalid_metadata' };
  pids = [...new Set(pids)];
  let text;
  try { text = await query(pids); } catch { return { coverage: 'unavailable' }; }
  if (typeof text !== 'string' || text.length > 4096) return { coverage: 'invalid_snapshot' };
  const seen = new Set(); let zombie = 0; let nonZombie = 0;
  for (const line of text.split(/\r?\n/).filter(line => line.trim())) {
    const match = /^\s*(\d+)\s+([RSTZXIDUW][A-Za-z+<>=-]{0,15})\s*$/.exec(line);
    const pid = Number(match?.[1]);
    if (!match || !pids.includes(pid) || seen.has(pid)) return { coverage: 'invalid_snapshot' };
    seen.add(pid); if (match[2].startsWith('Z')) zombie++; else nonZombie++;
  }
  return { coverage: 'reported_pids_only', nonZombie, zombie, missing: pids.length - seen.size, identityVerified: false };
}

async function queryGroups() {
  return (await exec('/bin/ps', ['-A', '-o', 'pid=,pgid=,uid=,stat='], { timeout: 1000, maxBuffer: 1048576 })).stdout;
}
// Group IDs can also be reused. Membership/UID counts are hints only, never
// proof of ownership, permission to signal, or permission to clear cleanup debt.
// A later snapshot does not establish membership at the time signaling failed.
export async function reportedProcessGroupHint(pids, { platform = process.platform, effectiveUid = process.geteuid?.(), query = queryGroups } = {}) {
  if (!['linux', 'darwin'].includes(platform)) return { coverage: 'not_collected' };
  if (!Array.isArray(pids) || !pids.length || pids.length > 16 || pids.some(pid => !Number.isSafeInteger(pid) || pid <= 1 || pid > 2147483647) || !Number.isSafeInteger(effectiveUid) || effectiveUid < 0)
    return { coverage: 'invalid_metadata' };
  let text;
  try { text = await query(); } catch { return { coverage: 'unavailable' }; }
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 1048576) return { coverage: 'invalid_snapshot' };
  const groups = new Map([...new Set(pids)].map(pid => [pid, { reportedGroup: pid, leaderPresent: false, members: 0, nonZombie: 0, zombie: 0, sameEffectiveUid: 0, differentEffectiveUid: 0 }]));
  const seen = new Set();
  for (const line of text.split(/\r?\n/).filter(line => line.trim())) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+([RSTtPZXIDUW][A-Za-z+<>=-]{0,15})\s*$/.exec(line);
    if (!match) return { coverage: 'invalid_snapshot' };
    const [pid, pgid, uid] = match.slice(1, 4).map(Number);
    if (![pid, pgid, uid].every(Number.isSafeInteger) || pid < 0 || pid > 2147483647 || pgid < 0 || pgid > 2147483647 || uid < 0 || seen.has(pid) || seen.size >= 16384)
      return { coverage: 'invalid_snapshot' };
    seen.add(pid);
    const group = groups.get(pgid);
    if (!group) continue;
    group.members++; if (pid === pgid) group.leaderPresent = true;
    if (match[4].startsWith('Z')) group.zombie++; else group.nonZombie++;
    if (uid === effectiveUid) group.sameEffectiveUid++; else group.differentEffectiveUid++;
  }
  return { coverage: 'reported_group_ids_only', identityVerified: false, groups: [...groups.values()] };
}
