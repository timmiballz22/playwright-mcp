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

// Fixed progress labels only; discard raw PowerShell diagnostics and values.
export function windowsCimFailurePhase(stderr) {
  if (typeof stderr !== 'string') return 'unknown';
  let phase = 'unknown';
  for (const match of stderr.matchAll(/^PWMCP_AUDIT_PHASE=(entered|query|projection|serialization|done)\r?$/gm)) phase = match[1];
  return phase;
}

// Fixed diagnostic counts only. Never use this receipt to filter ownership.
export function windowsAuditReceipt(roots, rows, observed, helperPid, identities, sinceMs) {
  const rootSet = new Set(roots);
  const observedSet = new Set(observed);
  const matches = rows.filter(row => observedSet.has(row.pid));
  return { observedCount: observed.length,
    auditHelperMatched: Number.isSafeInteger(helperPid) && observedSet.has(helperPid),
    rootMatches: observed.filter(pid => rootSet.has(pid)).length,
    rememberedRootBirths: [...rootSet].filter(pid => identities.has(pid)).length,
    birthsBeforeObservationWindow: Number.isFinite(sinceMs) ? matches.filter(row => valid(row.started) && Date.parse(row.started) < sinceMs).length : null,
    missingObservedBirths: matches.filter(row => !valid(row.started)).length };
}

// Each trusted child lifetime gets a separate identity map. Union observations
// across lifetimes so registering a new owned incarnation cannot erase older
// orphan ancestry or turn its birth mismatch into an ignored process.
export function windowsOwnedProcessScopes(scopes, rows, rememberLiveRoots = false) {
  const result = new Set();
  for (const scope of scopes) {
    // A long-lived controller can have exited historical browser roots. Preserve
    // those lineages before refreshing descendants through its live anchor.
    if (rememberLiveRoots && scope.liveRoots) {
      const validated = new Map(scope.identities);
      const current = windowsOwnedProcesses([...scope.liveRoots], rows, validated, true);
      // First capture must use the actual live anchor's validated birth before
      // historical traversal. Other unknown roots remain conservative; existing
      // historical identities are never replaced by this initialization.
      for (const pid of scope.liveRoots)
        if (!scope.identities.has(pid) && validated.has(pid)) scope.identities.set(pid, validated.get(pid));
      const historical = windowsOwnedProcesses([...scope.roots], rows, scope.identities);
      for (const pid of historical) { scope.roots.add(pid); result.add(pid); }
      for (const pid of current) {
        scope.identities.set(pid, validated.get(pid)); scope.roots.add(pid); result.add(pid);
      }
    } else {
      const observed = windowsOwnedProcesses([...scope.roots], rows, scope.identities, rememberLiveRoots);
      for (const pid of observed) { scope.roots.add(pid); result.add(pid); }
    }
  }
  return [...result].sort((a, b) => a - b);
}

// Diagnostic comparison only: retain every legacy candidate and its projected
// row. This never changes the scoped result or grants termination authority.
export function windowsLegacyComparison(roots, rows, scopedObserved, reviewRoots = roots) {
  const observed = windowsOwnedProcesses(roots, rows, new Map());
  const legacy = new Set(observed); const scoped = new Set(scopedObserved); const review = new Set(reviewRoots);
  return { observed, legacyOnly: observed.filter(pid => !scoped.has(pid)),
    rows: rows.filter(row => legacy.has(row.pid)).map(row => ({ pid: row.pid, parent: row.parent, started: row.started })),
    rootRows: rows.filter(row => review.has(row.pid)).map(row => ({ pid: row.pid, parent: row.parent, started: row.started })) };
}
