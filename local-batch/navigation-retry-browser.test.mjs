import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';

const policy = { maxRetries: 2, baseDelayMs: 100, maxDelayMs: 2000 };
for (const browser of (process.env.PLAYWRIGHT_BATCH_TEST_BROWSERS ?? 'chromium,firefox,webkit').split(',')) {
test(`real ${browser}: supervised navigation respects throttling and never replays form POST or over-cap waits`, async () => {
  const hits = new Map(); const times = new Map();
  const abort = new AbortController();
  let abortAt;
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    const key = req.method + req.url;
    hits.set(key, (hits.get(key) || 0) + 1);
    times.set(key, [...times.get(key) || [], performance.now()]);
    if (req.url === '/form') { res.setHeader('Content-Type', 'text/html'); res.end('<form method="post" action="/submit"><button>Send</button></form>'); return; }
    if (req.url === '/cancel') { res.writeHead(429, { 'Retry-After': '1' }); res.end('canary-rate-body'); if (hits.get(key) === 1) setTimeout(() => { abortAt = performance.now(); abort.abort(); }, 100); return; }
    const status = req.url === '/503' ? 503 : 429;
    if (req.url === '/submit' || req.url === '/cap' || req.url === '/exhaust' || hits.get(key) === 1) {
      res.writeHead(status, { 'Content-Type': 'text/html', 'Retry-After': req.url === '/cap' ? '99999999999999999999' : req.url === '/429' ? '1' : '0', 'X-Secret': 'canary-rate-header' });
      res.end('<div id="submitted">canary-rate-body</div>'); return;
    }
    res.end('<div id="ready">ready</div>');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const directory = await mkdtemp(path.join(os.tmpdir(), 'retry-browser-'));
  const run = async (route, extra = {}) => {
    const result = await executeWorkflow({ browser, timeoutMs: 10000, steps: [{ type: 'goto', url: origin + route }, ...(extra.steps || [])] }, {
      allowedOrigins: [origin], artifactsDir: directory, navigationRetry: policy, ...extra,
    });
    assert.equal(JSON.stringify(result).includes('canary'), false);
    assert.equal(result.execution.cleanup, 'terminated');
    assert.equal(result.execution.tempCleanup, 'removed');
    return result;
  };
  try {
    for (const route of ['/429', '/503', '/fragment#owned-fragment']) {
      const result = await run(route);
      assert.equal(result.ok, true, JSON.stringify({ route, reason: result.reason,
        completed: result.completed, failedStep: result.failedStep, execution: result.execution,
        hits: hits.get('GET' + new URL(route, origin).pathname) }));
      assert.equal(hits.get('GET' + new URL(route, origin).pathname), 2);
      const [first, second] = times.get('GET' + new URL(route, origin).pathname);
      assert.ok(second - first >= (route === '/429' ? 990 : 90));
    }
    const cap = await run('/cap'); assert.equal(cap.ok, false); assert.equal(cap.failedStep.httpStatus, 429);
    assert.equal(hits.get('GET/cap'), 1);
    const exhaust = await run('/exhaust'); assert.equal(exhaust.ok, false); assert.equal(hits.get('GET/exhaust'), 3);
    const cancelled = await run('/cancel', { signal: abort.signal });
    assert.equal(cancelled.reason, 'cancelled'); assert.equal(hits.get('GET/cancel'), 1, JSON.stringify({
      cancelAtMsAfterRequest: abortAt - times.get('GET/cancel')[0],
      requestOffsetsMs: times.get('GET/cancel').map(time => time - times.get('GET/cancel')[0]),
      reason: cancelled.reason, failedStep: cancelled.failedStep, execution: cancelled.execution,
    }));
    await run('/form', { steps: [{ type: 'click', selector: 'button' }, { type: 'waitFor', selector: '#submitted' }] });
    assert.equal(hits.get('POST/submit'), 1);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
});
}
