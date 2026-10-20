// Read-only test audit. Roots come from trusted child handles, never workflows.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
const exec = promisify(execFile);
export async function ownedDescendants(roots) {
  const owned = new Set(roots.filter(pid => Number.isSafeInteger(pid) && pid > 1));
  let rows;
  if (process.platform === 'win32') {
    const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const script = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress';
    const { stdout } = await exec(executable, ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 5000, maxBuffer: 1048576, windowsHide: true });
    const parsed = JSON.parse(stdout);
    rows = (Array.isArray(parsed) ? parsed : [parsed]).map(row => ({ pid: Number(row.ProcessId), parent: Number(row.ParentProcessId) }));
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
