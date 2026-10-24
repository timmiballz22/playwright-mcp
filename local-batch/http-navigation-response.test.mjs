import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWorkflow } from './runner.mjs';

function fixture(status, { main = true, method = 'GET', pending = true, onFetch, fulfillFailure = false, disposeFailure = false, fetchResponse, url = 'http://127.0.0.1:4321/' } = {}) {
  const state = { fetched: 0, fulfilled: 0, aborted: 0, disposed: 0 };
  const frame = {}; let handler;
  const response = { status: () => status, headers: () => ({ 'retry-after': '0', 'x-private': 'fake-response-private-canary' }), dispose: async () => { state.disposed++; if (disposeFailure) throw new Error('fake-dispose-private-canary'); } };
  const route = { request: () => ({ url: () => url, method: () => method,
    isNavigationRequest: () => true, frame: () => main ? frame : {} }),
  fetch: async () => {
    state.fetched++; onFetch?.();
    if (!fetchResponse) return response;
    const actual = await fetchResponse(); const dispose = actual.dispose.bind(actual);
    actual.dispose = async () => { state.disposed++; return dispose(); };
    return actual;
  }, fulfill: async () => { state.fulfilled++; if (fulfillFailure) throw new Error('fake-fulfill-private-canary'); }, abort: async () => { state.aborted++; } };
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

test('failed fulfillment disposes its fetched response without replay or hiding the request failure', async () => {
  const mock = fixture(200, { pending: false, fulfillFailure: true });
  const result = await runWorkflow({ timeoutMs: 1000, steps: [{ type: 'goto', url: 'http://127.0.0.1:4321/' }] },
    { ...mock, allowedOrigins: ['http://127.0.0.1:4321'] });
  assert.equal(result.ok, false); assert.equal(result.reason, 'policy_blocked');
  assert.equal(result.blockedRequests, 1);
  assert.deepEqual(mock.state, { fetched: 1, fulfilled: 1, aborted: 1, disposed: 1 });
  assert.equal(JSON.stringify(result).includes('private-canary'), false);
});

for (const status of [200, 503]) test(`response disposal rejection preserves the existing failure and is not retried (${status})`, async () => {
  const mock = fixture(status, { pending: false, disposeFailure: true });
  const result = await runWorkflow({ timeoutMs: 1000, steps: [{ type: 'goto', url: 'http://127.0.0.1:4321/' }] },
    { ...mock, allowedOrigins: ['http://127.0.0.1:4321'] });
  assert.equal(result.ok, false); assert.equal(result.reason, status === 503 ? 'action_failed' : 'policy_blocked');
  assert.equal(mock.state.disposed, 1); assert.equal(mock.state.fetched, 1);
  if (status === 503) { assert.equal(result.results[0].httpStatus, 503); assert.equal(result.blockedRequests, 0); }
  assert.equal(JSON.stringify(result).includes('private-canary'), false);
});

for (const method of ['GET', 'POST']) test(`failed fulfillment releases a real retained API response before its request context closes (${method})`, { timeout: 10000 }, async () => {
  const { createServer } = await import('node:http'); const { once } = await import('node:events');
  const { request } = await import('playwright'); let hits = 0; let writes = 0; let api; let captured;
  const server = createServer((req, res) => { hits++; if (req.method === 'POST') writes++; res.writeHead(200, { 'content-type': 'application/octet-stream' }); res.end(Buffer.alloc(65536, 42)); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`; const url = origin + '/';
  try {
    api = await request.newContext({ timeout: 1000 });
    const mock = fixture(200, { pending: false, fulfillFailure: true, method, url, fetchResponse: async () => {
      captured = await api.fetch(url, { method, maxRedirects: 0, maxRetries: 0 });
      assert.equal((await captured.body()).length, 65536); return captured;
    } });
    const result = await runWorkflow({ timeoutMs: 2000, steps: [{ type: 'goto', url }] }, { ...mock, allowedOrigins: [origin] });
    assert.equal(result.reason, 'policy_blocked'); assert.equal(hits, 1); assert.equal(writes, method === 'POST' ? 1 : 0);
    // The request context is still open: disposal, not context teardown, freed it.
    await assert.rejects(captured.body(), /Response has been disposed/);
    assert.equal(mock.state.disposed, 1);
  } finally {
    try { await api?.dispose(); }
    finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});
