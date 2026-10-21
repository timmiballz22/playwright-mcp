// Test-only call metadata. Never retain arguments, results, exception text or IDs.
export function trackToolProgress(client, allowedNames) {
  const call = client.callTool;
  const known = new Set(allowedNames);
  const active = new Map(); const recent = [];
  let calls = 0; let pending = 0;
  client.callTool = async function(...args) {
    const tool = known.has(args[0]?.name) ? args[0].name : 'unknown_tool';
    const id = ++calls; const began = performance.now(); pending++;
    if (active.size < 4) active.set(id, { tool, began });
    let outcome = 'rejected';
    try {
      const result = await Reflect.apply(call, this, args);
      outcome = result?.isError === true ? 'tool_error' : 'returned';
      return result;
    } finally {
      pending--; active.delete(id);
      recent.push({ tool, outcome, durationMs: Math.round(performance.now() - began) });
      if (recent.length > 4) recent.shift();
    }
  };
  return () => ({ calls, pending,
    active: [...active.values()].map(({ tool, began }) => ({ tool, pendingMs: Math.round(performance.now() - began) })),
    recent: recent.map(value => ({ ...value })),
  });
}
