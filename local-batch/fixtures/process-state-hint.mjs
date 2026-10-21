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
