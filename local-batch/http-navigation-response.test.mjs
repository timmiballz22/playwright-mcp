import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWorkflow } from './runner.mjs';

function fixture(status, { main = true, method = 'GET', pending = true, onFetch } = {}) {
  const state = { fetched: 0, fulfilled: 0, aborted: 0 };
  const frame = {}; let handler;
  const response = { status: () => status, headers: () => ({ 'retry-after': '0', 'x-private': 'fake-response-private-canary' }), dispose: async () => {} };
  const route = { request: () => ({ url: () => 'http://127.0.0.1:4321/', method: () => method,
    isNavigationRequest: () => true, frame: () => main ? frame : {} }),
  fetch: async () => { state.fetched++; onFetch?.(); return response; }, fulfill: async () => { state.fulfilled++; }, abort: async () => { state.aborted++; } };
  const page = { mainFrame: () => frame, goto: async () => {
    await handler(route);
    if (pending) return await new Promise(() => {});
    return { status: () => 200 };
  } };
  const context = { setDefaultTimeout() {}, setDefaultNavigationTimeout() {}, route: async (_pattern, value) => { handler = value; },
    newPage: async () => page, close: async () => {} };
  const browser = { newContext: async () => context, close: async () => {} };
  return { state, playwright: { chromium: { launch: async () => browser } } };
}

for (const [status, code] of [[401, 'http_401'], [403, 'http_403'], [404, 'http_404'], [429, 'rate_limited'], [503, 'http_5xx']]) {
  test(`known main GET ${status} fails precisely even when document readiness never settles`, async () => {
    const mock = fixture(status); let earlyFailure;
    const result = await runWorkflow({ timeoutMs: 200, steps: [{ type: 'goto', url: 'http://127.0.0.1:4321/' }] },
      { ...mock, allowedOrigins: ['http://127.0.0.1:4321'], onActionFailure: (_error, step) => { earlyFailure = step; } });
    assert.equal(earlyFailure.httpStatus, status); assert.equal(earlyFailure.retryAfterMs, 0);
    assert.equal(result.reason, 'action_failed'); assert.equal(result.completed, 0);
    assert.equal(result.results[0].error, code); assert.equal(result.results[0].httpStatus, status);
    assert.equal(result.results[0].failureKind, 'http_failure');
    assert.equal(mock.state.fetched, 1); assert.equal(mock.state.fulfilled, 0);
    assert.equal(mock.state.aborted, 1); assert.equal(result.blockedRequests, 0);
    assert.equal(JSON.stringify(result).includes('fake-response-private-canary'), false);
  });
}

for (const options of [{ main: false }, { method: 'POST' }]) {
  test(`HTTP error outside the current main GET does not become its navigation failure (${JSON.stringify(options)})`, async () => {
    const mock = fixture(404, { ...options, pending: false });
    const result = await runWorkflow({ timeoutMs: 1000, steps: [{ type: 'goto', url: 'http://127.0.0.1:4321/' }] },
      { ...mock, allowedOrigins: ['http://127.0.0.1:4321'] });
    assert.equal(result.ok, true); assert.equal(result.completed, 1);
    assert.equal(mock.state.fulfilled, 1); assert.equal(mock.state.aborted, 0);
  });
}


test('known HTTP failure waits for the configured retry attempts before failing without DOM readiness', async () => {
  const mock = fixture(503);
  const result = await runWorkflow({ timeoutMs: 2000, steps: [{ type: 'goto', url: 'http://127.0.0.1:4321/' }] },
    { ...mock, allowedOrigins: ['http://127.0.0.1:4321'], navigationRetry: { maxRetries: 2, baseDelayMs: 100, maxDelayMs: 2000 } });
  assert.equal(result.results[0].error, 'http_5xx'); assert.equal(result.results[0].httpStatus, 503);
  assert.equal(mock.state.fetched, 3); assert.equal(mock.state.fulfilled, 0); assert.equal(mock.state.aborted, 1);
});

test('observed cancellation keeps precedence over a newly available HTTP failure', async () => {
  const abort = new AbortController();
  const mock = fixture(404, { onFetch: () => abort.abort() });
  const result = await runWorkflow({ timeoutMs: 1000, steps: [{ type: 'goto', url: 'http://127.0.0.1:4321/' }] },
    { ...mock, allowedOrigins: ['http://127.0.0.1:4321'], signal: abort.signal });
  assert.equal(result.reason, 'cancelled'); assert.equal(result.completed, 0);
  assert.equal(result.results[0].error, 'cancelled');
});
