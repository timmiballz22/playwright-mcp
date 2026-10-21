// Read-only test audit. Roots come from trusted child handles, never workflows.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { windowsOwnedProcesses, windowsOwnedProcessScopes, windowsCimFailurePhase, windowsAuditReceipt, windowsLegacyComparison } from './windows-process-graph.mjs';
const identities = new Map();
const exec = promisify(execFile);
export async function ownedDescendants(roots, { rememberLiveRoots = false, onReceipt, sinceMs, identityScopes, compareLegacyRoots, onLegacyObservation } = {}) {
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
    const result = identityScopes ? windowsOwnedProcessScopes(identityScopes, rows, rememberLiveRoots) : windowsOwnedProcesses(roots, rows, identities, rememberLiveRoots);
    if (compareLegacyRoots) {
      const reviewRoots = identityScopes ? identityScopes.flatMap(scope => [...scope.roots]) : [...compareLegacyRoots];
      if (Number.isSafeInteger(helperPid)) reviewRoots.push(helperPid);
      try {
        const legacy = windowsLegacyComparison(compareLegacyRoots, rows, result, reviewRoots);
        onLegacyObservation?.({ ...legacy, auditHelperPid: Number.isSafeInteger(helperPid) ? helperPid : null,
          auditHelperMatched: Number.isSafeInteger(helperPid) && legacy.observed.includes(helperPid) });
      } catch {}
    }
    // Diagnostic only: a matching audit helper remains in the conservative
    // result. Never hide a possible orphan based on its role or PID reuse.
    try { onReceipt?.(windowsAuditReceipt([...owned], rows, result, helperPid, identityScopes ? new Map(identityScopes.flatMap(scope => [...scope.identities])) : identities, sinceMs)); } catch {}
    return result;
  } else {
    const { stdout } = await exec('/bin/ps', ['-A', '-o', 'pid=,ppid=,pgid=,stat='], { timeout: 2000, maxBuffer: 1048576 });
    rows = stdout.trim().split('\n').map(line => {
      const [pid, parent, group, state] = line.trim().split(/\s+/);
      return { pid: Number(pid), parent: Number(parent), group: Number(group), zombie: state?.startsWith('Z') };
    });
  }
  const collect = roots => {
    const descendants = new Set(roots); let previous;
    do {
      previous = descendants.size;
      for (const row of rows) if (descendants.has(row.parent) || descendants.has(row.group)) descendants.add(row.pid);
    } while (descendants.size !== previous);
    return rows.filter(row => descendants.has(row.pid) && !row.zombie).map(row => row.pid);
  };
  if (identityScopes) {
    const all = new Set();
    for (const scope of identityScopes) for (const pid of collect(scope.roots)) { scope.roots.add(pid); all.add(pid); }
    return [...all].sort((a, b) => a - b);
  }
  return collect(owned).sort((a, b) => a - b);
}

// Source-only test ownership ledger. One process-table read covers every scope.
export function ownedScopeDescendants(scopes, options = {}) {
  return ownedDescendants([...new Set(scopes.flatMap(scope => [...scope.roots]))], { ...options, identityScopes: scopes });
}
