import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';

const policy = { maxRetries: 2, baseDelayMs: 100, maxDelayMs: 2000 };
for (const browser of (process.env.PLAYWRIGHT_BATCH_TEST_BROWSERS ?? 'chromium,firefox,webkit').split(',')) {
test(`real ${browser}: supervised navigation respects throttling and never replays form POST or over-cap waits`, async () => {
  const hits = new Map(); const times = new Map(); const finished = new Map();
  let latestTiming; let accepted = false;
  const abort = new AbortController();
  let abortAt;
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    const key = req.method + req.url;
    res.once('finish', () => finished.set(key, { count: (finished.get(key)?.count ?? 0) + 1, at: performance.now() }));
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
    const started = performance.now(); const phases = { supervisorEventMs: null, workerEventMs: null, browserEventMs: null };
    const result = await executeWorkflow({ browser, timeoutMs: 10000, steps: [{ type: 'goto', url: origin + route }, ...(extra.steps || [])] }, {
      allowedOrigins: [origin], artifactsDir: directory, navigationRetry: policy, ...extra,
      onEvent: event => {
        if (event.type === 'supervisorSpawned') phases.supervisorEventMs = Math.round(performance.now() - started);
        if (event.type === 'workerSpawned') phases.workerEventMs = Math.round(performance.now() - started);
        if (event.type === 'ownedProcess') phases.browserEventMs = Math.round(performance.now() - started);
        extra.onEvent?.(event);
      },
    });
    const key = 'GET' + new URL(route, origin).pathname;
    latestTiming = { ...phases, requestsSeen: hits.get(key) ?? 0, responsesFinished: finished.get(key)?.count ?? 0,
      firstRequestMs: times.has(key) ? Math.round(times.get(key)[0] - started) : null,
      lastResponseFinishedMs: finished.has(key) ? Math.round(finished.get(key).at - started) : null };
    assert.equal(JSON.stringify(result).includes('canary'), false);
    assert.equal(result.execution.cleanup, 'terminated', JSON.stringify({ fixture: 'navigation_retry_cleanup', browser, scenario: new URL(route, origin).pathname, reason: result.reason, completed: result.completed, failedStep: result.failedStep, execution: result.execution, timing: latestTiming }));
    assert.equal(result.execution.tempCleanup, 'removed');
    return result;
  };
  try {
    for (const route of ['/429', '/503', '/fragment#owned-fragment']) {
      const result = await run(route);
      assert.equal(result.ok, true, JSON.stringify({ route, reason: result.reason,
        completed: result.completed, failedStep: result.failedStep, execution: result.execution,
        hits: hits.get('GET' + new URL(route, origin).pathname), timing: latestTiming }));
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
    const form = await run('/form', { steps: [{ type: 'click', selector: 'button' }, { type: 'waitFor', selector: '#submitted' }] });
    assert.equal(form.ok, true, JSON.stringify({ route: '/form', reason: form.reason, completed: form.completed,
      failedStep: form.failedStep, execution: form.execution, postHits: hits.get('POST/submit') ?? 0 }));
    assert.equal(hits.get('POST/submit'), 1);
    accepted = true;
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    if (accepted) await rm(directory, { recursive: true, force: true });
    else console.error('Navigation retry fixture preserved: acceptance or cleanup not confirmed');
  }
});
}

// Independent source-only witness. Existing throttling/cancel assertions above
// remain unchanged; marked traffic never leaves this private local server.
for (const browser of (process.env.PLAYWRIGHT_BATCH_TEST_BROWSERS ?? 'chromium,firefox,webkit').split(',')) {
  test(`real ${browser}: cancellation preserves a committed POST once and identifies public fetch calls`, { timeout: 40000 }, async () => {
    const records = []; let active; let pending; let verified = false; let primary;
    const root = await mkdtemp(path.join(os.tmpdir(), 'cancel-fetch-witness-'));
    const owned = [];
    const fixture = createServer((request, response) => {
      const row = { method: request.method, path: request.url, fetchId: request.headers['x-pwmcp-private-fetch'] ?? null, at: performance.now() };
      records.push(row);
      if (request.url === '/form' || request.url === '/form-stalled') { response.setHeader('Content-Type', 'text/html'); response.end('<form method="post" action="' + (request.url === '/form-stalled' ? '/commit-stalled' : '/commit') + '"><button>Commit</button></form>'); return; }
      if (request.url === '/commit' || request.url === '/commit-stalled' || request.url === '/cancel') {
        // /commit is a committed local ledger entry with no response: abort
        // cannot establish whether the client observed its effect.
        if (request.url === '/cancel') { response.writeHead(429, { 'Retry-After': '1' }); response.end('fixed fixture'); }
        if (!active.scheduled) { active.scheduled = true; setTimeout(() => { active.at = performance.now(); active.abort.abort(); }, 100); }
        return;
      }
      response.writeHead(404); response.end();
    });
    fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const previousCloseStall = process.env.PLAYWRIGHT_TEST_PRIVATE_FETCH_CLOSE_STALL;
    try {
      for (const scenario of ['cancel', 'commit', 'commit-stalled']) {
        if (scenario === 'commit-stalled') process.env.PLAYWRIGHT_TEST_PRIVATE_FETCH_CLOSE_STALL = '1';
        else delete process.env.PLAYWRIGHT_TEST_PRIVATE_FETCH_CLOSE_STALL;
        const committed = scenario !== 'cancel';
        active = { abort: new AbortController(), scheduled: false };
        pending = executeWorkflow({ browser, timeoutMs: 10000, steps: [{ type: 'goto', url: origin + (committed ? scenario === 'commit-stalled' ? '/form-stalled' : '/form' : '/cancel') }, ...(committed ? [{ type: 'click', selector: 'button' }] : [])] }, {
          artifactsDir: root, allowedOrigins: [origin], navigationRetry: policy, signal: active.abort.signal,
          workerModule: new URL('./jobs/fixtures/marked-fetch-worker.mjs', import.meta.url),
          onEvent: event => { if (event.pid) owned.push(event.pid); },
        });
        const result = await pending;
        const requests = records.filter(row => row.path === '/' + scenario);
        const receipt = { scenario, reason: result.reason, completed: result.completed, execution: result.execution,
          requests: requests.map(row => ({ method: row.method, fetchId: row.fetchId, offsetMs: Math.round(row.at - requests[0].at) })),
          abortOffsetMs: requests.length ? Math.round(active.at - requests[0].at) : null };
        assert.equal(result.reason, 'cancelled', JSON.stringify(receipt));
        assert.equal(requests.length, 1, JSON.stringify(receipt));
        assert.match(requests[0].fetchId, /^[1-9]\d*$/);
        assert.equal(requests[0].method, committed ? 'POST' : 'GET');
        assert.equal(result.retrySafe, false); assert.equal(result.completed, committed ? 1 : 0);
        assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
        if (scenario === 'commit-stalled') {
          assert.deepEqual(JSON.parse(await readFile(path.join(root, 'exec-' + result.runId, 'fetch-abort-witness.json'), 'utf8')),
            { signalAborted: true, browserConnected: true, method: 'POST' });
        }
        console.log(JSON.stringify({ component: 'private_fetch_cancel_witness', browser, ...receipt }));
      }
      verified = true;
    } catch (error) { primary = error; throw error; }
    finally {
      if (previousCloseStall === undefined) delete process.env.PLAYWRIGHT_TEST_PRIVATE_FETCH_CLOSE_STALL;
      else process.env.PLAYWRIGHT_TEST_PRIVATE_FETCH_CLOSE_STALL = previousCloseStall;
      try {
        active?.abort.abort(); if (pending) await pending;
        fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
        assert.deepEqual(await ownedDescendants(owned), []);
        if (verified) await rm(root, { recursive: true, force: true });
      } catch (error) {
        if (primary) throw new AggregateError([primary, error], 'Cancellation witness and teardown failed');
        throw error;
      }
    }
  });
}
