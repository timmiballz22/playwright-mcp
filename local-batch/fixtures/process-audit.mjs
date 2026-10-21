// Read-only test audit. Roots come from trusted child handles, never workflows.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { windowsOwnedProcesses, windowsCimFailurePhase, windowsAuditReceipt } from './windows-process-graph.mjs';
const identities = new Map();
const exec = promisify(execFile);
export async function ownedDescendants(roots, { rememberLiveRoots = false, onReceipt, sinceMs } = {}) {
  const owned = new Set(roots.filter(pid => Number.isSafeInteger(pid) && pid > 1));
  let rows;
  if (process.platform === 'win32') {
    const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const script = String.raw`$ErrorActionPreference = 'Stop'
[Console]::Error.WriteLine('PWMCP_AUDIT_PHASE=entered')
[Console]::Error.WriteLine('PWMCP_AUDIT_PHASE=query')
$processes = Get-CimInstance -ClassName Win32_Process -Property ProcessId,ParentProcessId,CreationDate
[Console]::Error.WriteLine('PWMCP_AUDIT_PHASE=projection')
$rows = $processes | Select-Object ProcessId,ParentProcessId,@{Name='Started';Expression={if ($_.CreationDate) {$_.CreationDate.ToUniversalTime().ToString('o')} else {$null}}}
[Console]::Error.WriteLine('PWMCP_AUDIT_PHASE=serialization')
$json = $rows | ConvertTo-Json -Compress
[Console]::Error.WriteLine('PWMCP_AUDIT_PHASE=done')
[Console]::Out.Write($json)`;
    let stdout;
    let helperPid;
    try {
      // Native cold WMI startup exceeded the previous five-second test audit
      // bound. This is read-only evidence collection, never execution cleanup.
      const query = exec(executable, ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 10000, maxBuffer: 1048576, windowsHide: true });
      helperPid = query.child?.pid;
      ({ stdout } = await query);
    } catch (error) {
      const kind = error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? 'output_limit' :
        error.killed ? 'timeout' : Number.isInteger(error.code) ? 'exit_' + error.code :
        ['ENOENT', 'EACCES'].includes(error.code) ? error.code.toLowerCase() : 'command_failed';
      throw new Error('process_audit_windows_cim_' + kind + '_phase_' + windowsCimFailurePhase(error.stderr));
    }
    const parsed = JSON.parse(stdout);
    rows = (Array.isArray(parsed) ? parsed : [parsed]).map(row => ({ pid: Number(row.ProcessId), parent: Number(row.ParentProcessId), started: row.Started }));
    const result = windowsOwnedProcesses(roots, rows, identities, rememberLiveRoots);
    // Diagnostic only: a matching audit helper remains in the conservative
    // result. Never hide a possible orphan based on its role or PID reuse.
    try { onReceipt?.(windowsAuditReceipt([...owned], rows, result, helperPid, identities, sinceMs)); } catch {}
    return result;
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
