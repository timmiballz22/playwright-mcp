// Checkout-only fixture teardown. The pinned SDK has two existing 2s waits.
// Join its close and the actual drained pipe within that same total ceiling;
// never start a second wait budget after close returns, or infer process exits.
export const SDK_CLOSE_BUDGET_MS = 4000;
export async function closeWithStderr(close, stderrEnd) {
  let timer;
  const completion = Promise.allSettled([Promise.resolve().then(close), stderrEnd]);
  try {
    const results = await Promise.race([completion, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('fixture_close_or_stderr_unconfirmed')), SDK_CLOSE_BUDGET_MS);
    })]);
    const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
    if (failures.length) throw new AggregateError(failures, 'Fixture client close or stderr failed');
  } finally { clearTimeout(timer); }
}
