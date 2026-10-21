// Read-only ownership evidence, never process termination. Unknown legacy roots
// remain conservative; only explicitly live roots establish precise identities.
const valid = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{7}Z$/.test(value);
const uncertain = kind => { throw new Error('process_audit_windows_identity_unavailable_' + kind); };
export function windowsOwnedProcesses(roots, rows, identities = new Map(), rememberLiveRoots = false) {
  const byPid = new Map(rows.map(row => [row.pid, row]));
  const ranges = new Map(); const owned = new Set();
  const add = (pid, lower, upper) => { const list = ranges.get(pid) ?? []; list.push({ lower, upper }); ranges.set(pid, list); };
  for (const pid of new Set(roots.filter(pid => Number.isSafeInteger(pid) && pid > 1))) {
    const row = byPid.get(pid); let expected = identities.get(pid);
    if (rememberLiveRoots) {
      if (!row) uncertain('root_missing');
      if (!valid(row.started)) uncertain('root_birth_missing');
      if (expected && expected !== row.started) uncertain('root_birth_changed');
      expected = row.started; identities.set(pid, expected);
    }
    if (!expected) { add(pid, null, null); if (row) owned.add(pid); continue; }
    if (row && !valid(row.started)) uncertain('root_birth_missing');
    if (row && row.started < expected) uncertain('root_birth_reversed');
    // A reused PID is not the old root, but its earlier orphaned children still
    // need inspection. Their creation precedes the replacement incarnation.
    const upper = row && row.started !== expected ? row.started : null;
    add(pid, expected, upper);
    if (row?.started === expected) owned.add(pid);
  }
  let previous;
  do {
    previous = owned.size;
    for (const row of rows) {
      if (owned.has(row.pid)) continue;
      const parents = ranges.get(row.parent); if (!parents) continue;
      const legacy = parents.some(range => range.lower === null);
      if (!legacy && !valid(row.started)) uncertain('descendant_birth_missing');
      const accepted = legacy || parents.some(range => row.started >= range.lower && (!range.upper || row.started < range.upper));
      if (!accepted) continue;
      owned.add(row.pid);
      if (!legacy) { identities.set(row.pid, row.started); add(row.pid, row.started, null); }
      else add(row.pid, null, null);
    }
  } while (owned.size !== previous);
  return rows.filter(row => owned.has(row.pid)).map(row => row.pid).sort((a, b) => a - b);
}
