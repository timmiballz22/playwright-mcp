// Termination is scoped to a fork we own and browser process groups reported by
// its trusted worker. No PID, program name or shell command comes from workflows.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const exec = promisify(execFile);
export { TERMINATION_FAILURE_CODES } from './failure.mjs';
const validPid = pid => Number.isSafeInteger(pid) && pid > 1 && pid !== process.pid;
function signal(pid, name, onFailure) {
  try { process.kill(pid, name); return true; }
  catch (error) { if (error?.code === 'ESRCH') return true; onFailure?.(error?.code); return false; }
}

export async function terminateOwnedProcesses(rootPid, browserPids = [], rootRunning = true, onDiagnostic) {
  const note = code => { try { onDiagnostic?.(code); } catch {} };
  let signalDetailReported = false;
  const ownedSignal = (pid, name) => signal(pid, name, code => {
    if (signalDetailReported) return;
    signalDetailReported = true;
    note(['EPERM', 'EACCES'].includes(code) ? 'signal_permission_denied' : code === 'EINVAL' ? 'signal_invalid_argument' : 'signal_unknown_error');
  });
  const checked = (ok, code) => { if (!ok) note(code); return ok; };
  if (!validPid(rootPid)) { note('invalid_root'); return false; }
  const owned = new Set(browserPids.filter(validPid));
  const verify = new Set(owned);
  if (rootRunning) verify.add(rootPid);
  const end = performance.now() + 2000;
  const commandTimeout = () => Math.max(1, Math.floor(Math.min(1500, end - performance.now())));
  let ok = true;
  if (process.platform === 'win32') {
    // /T catches startup children even before launchServer can report its PID.
    for (const pid of new Set([...owned, ...(rootRunning ? [rootPid] : [])])) {
      try {
        await exec(path.join(process.env.SystemRoot || 'C:\Windows', 'System32', 'taskkill.exe'), ['/PID', String(pid), '/T', '/F'], { timeout: commandTimeout(), windowsHide: true, maxBuffer: 65536 });
      } catch {
        try { process.kill(pid, 0); ok = false; note('windows_taskkill_failed'); } catch { /* already gone */ }
      }
    }
    return checked(await waitStopped(verify, end), 'wait_timeout') && ok;
  }
  const groups = new Set(owned);
  const individual = new Set();
  if (rootRunning) {
    // Freeze the worker before enumerating launch-time children. Playwright
    // creates its own detached browser groups (pinned processLauncher).
    ok = checked(ownedSignal(rootPid, 'SIGSTOP'), 'worker_stop_failed') && ok;
    groups.add(rootPid); // our fork is detached, so its PGID is its PID
    try {
      const { stdout } = await exec('/bin/ps', ['-A', '-o', 'pid=,ppid=,pgid='], { timeout: commandTimeout(), maxBuffer: 1048576 });
      const rows = stdout.trim().split('\n').map(line => line.trim().split(/\s+/).map(Number))
        .filter(row => row.length === 3 && row.every(Number.isSafeInteger));
      const descendants = new Set([rootPid]);
      let previous;
      do {
        previous = descendants.size;
        for (const [pid, ppid] of rows) if (descendants.has(ppid)) descendants.add(pid);
      } while (previous !== descendants.size);
      for (const [pid, , pgid] of rows) {
        if (!descendants.has(pid)) continue;
        verify.add(pid);
        if (descendants.has(pgid)) groups.add(pgid);
        else individual.add(pid); // never kill an unrelated containing group
      }
    } catch { ok = false; note('enumeration_failed'); }
  }
  for (const pid of individual) ok = checked(ownedSignal(pid, 'SIGKILL'), 'descendant_signal_failed') && ok;
  for (const pid of [...groups].filter(pid => pid !== rootPid)) ok = checked(ownedSignal(-pid, 'SIGKILL'), 'browser_group_signal_failed') && ok;
  if (rootRunning) ok = checked(ownedSignal(-rootPid, 'SIGKILL'), 'worker_group_signal_failed') && ok;
  return checked(await waitStopped(verify, end), 'wait_timeout') && ok;
}

async function waitStopped(pids, end) {
  while (true) {
    const active = await Promise.all([...pids].map(async pid => {
      try {
        process.kill(pid, 0);
        if (process.platform === 'linux') {
          const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
          if (stat.slice(stat.lastIndexOf(')') + 2).startsWith('Z ')) return false;
        }
        return true;
      } catch (error) { return error.code !== 'ESRCH' && error.code !== 'ENOENT'; }
    }));
    if (!active.some(Boolean)) return true;
    if (performance.now() >= end) return false;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
