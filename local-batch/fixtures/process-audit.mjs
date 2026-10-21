// Read-only test audit. Roots come from trusted child handles, never workflows.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { windowsOwnedProcesses } from './windows-process-graph.mjs';
const identities = new Map();
const exec = promisify(execFile);
export async function ownedDescendants(roots, { rememberLiveRoots = false } = {}) {
  const owned = new Set(roots.filter(pid => Number.isSafeInteger(pid) && pid > 1));
  let rows;
  if (process.platform === 'win32') {
    const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const script = "Get-CimInstance -ClassName Win32_Process -Property ProcessId,ParentProcessId,CreationDate | Select-Object ProcessId,ParentProcessId,@{Name='Started';Expression={if ($_.CreationDate) {$_.CreationDate.ToUniversalTime().ToString('o')} else {$null}}} | ConvertTo-Json -Compress";
    let stdout;
    try {
      // Native cold WMI startup exceeded the previous five-second test audit
      // bound. This is read-only evidence collection, never execution cleanup.
      ({ stdout } = await exec(executable, ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 10000, maxBuffer: 1048576, windowsHide: true }));
    } catch (error) {
      const kind = error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? 'output_limit' :
        error.killed ? 'timeout' : Number.isInteger(error.code) ? 'exit_' + error.code :
        ['ENOENT', 'EACCES'].includes(error.code) ? error.code.toLowerCase() : 'command_failed';
      throw new Error('process_audit_windows_cim_' + kind);
    }
    const parsed = JSON.parse(stdout);
    rows = (Array.isArray(parsed) ? parsed : [parsed]).map(row => ({ pid: Number(row.ProcessId), parent: Number(row.ParentProcessId), started: row.Started }));
    return windowsOwnedProcesses(roots, rows, identities, rememberLiveRoots);
  } else {
    const { stdout } = await exec('/bin/ps', ['-A', '-o', 'pid=,ppid=,pgid=,stat='], { timeout: 2000, maxBuffer: 1048576 });
    rows = stdout.trim().split('\n').map(line => {
      const [pid, parent, group, state] = line.trim().split(/\s+/);
      return { pid: Number(pid), parent: Number(parent), group: Number(group), zombie: state?.startsWith('Z') };
    });
  }
  let previous;
  do {
    previous = owned.size;
    for (const row of rows) if (owned.has(row.parent) || owned.has(row.group)) owned.add(row.pid);
  } while (previous !== owned.size);
  return rows.filter(row => owned.has(row.pid) && !row.zombie).map(row => row.pid).sort((a, b) => a - b);
}
