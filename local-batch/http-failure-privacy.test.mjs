import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';

for (const browser of (process.env.PLAYWRIGHT_BATCH_TEST_BROWSERS ?? 'chromium,firefox,webkit').split(',')) {
  test(`real ${browser}: HTTP error codes and script exceptions keep response secrets out of reports`, { timeout: 120000 }, async () => {
    const hits = new Map();
    const canaries = ['fake-query-private-canary', 'fake-header-private-canary', 'fake-body-private-canary', 'fake-script-private-canary'];
    const server = createServer((request, response) => {
      const route = new URL(request.url, 'http://fixture.invalid').pathname;
      hits.set(route, (hits.get(route) ?? 0) + 1);
      const status = /^\/[45]\d\d$/.test(route) ? Number(route.slice(1)) : route === '/script' ? 200 : 404;
      response.writeHead(status, {
        'Content-Type': 'text/html', 'X-Fixture-Secret': canaries[1], 'Cache-Control': 'no-store',
      });
      response.end(`<p>${canaries[2]}</p>${route === '/script' ? `<script>document.querySelector('p').id='script-ran';throw new Error('${canaries[3]}')</script>` : ''}`);
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const directory = await mkdtemp(path.join(os.tmpdir(), 'http-privacy-'));
    const owned = [];
    try {
      for (const [route, code] of [['/401', 'http_401'], ['/403', 'http_403'], ['/404', 'http_404'],
        ['/418', 'http_4xx'], ['/429', 'rate_limited'], ['/500', 'http_5xx'], ['/503', 'http_5xx'], ['/script', null]]) {
        const result = await executeWorkflow({ browser, timeoutMs: 15000, actionTimeoutMs: 3000,
          steps: [{ type: 'goto', url: `${origin}${route}?secret=${canaries[0]}` },
            { type: 'assertText', selector: '#script-ran', equals: canaries[2] }] }, {
          allowedOrigins: [origin], artifactsDir: directory,
          onEvent: event => { if (event.pid) owned.push(event.pid); },
        });
        assert.equal(result.execution.cleanup, 'terminated');
        assert.equal(result.execution.tempCleanup, 'removed');
        assert.equal(result.ok, code === null, JSON.stringify({ route, reason: result.reason, failedStep: result.failedStep }));
        assert.equal(result.completed, code === null ? 2 : 0);
        assert.equal(result.failedStep?.error ?? null, code);
        if (code) {
          assert.equal(result.reason, 'action_failed');
          assert.equal(result.failedStep.failureKind, 'http_failure');
          assert.equal(result.failedStep.httpStatus, Number(route.slice(1)));
          assert.equal(result.failedStep.index, 1);
          assert.equal(result.retrySafe, false);
        }
        assert.equal(hits.get(route), 1, 'Default navigation must not retry HTTP errors');
        const report = await readFile(result.reportPath, 'utf8');
        for (const secret of canaries) {
          assert.equal(JSON.stringify(result).includes(secret), false, 'Summary leaked fixture secret');
          assert.equal(report.includes(secret), false, 'Saved report leaked fixture secret');
        }
      }
    } finally {
      try { assert.deepEqual(await ownedDescendants(owned), []); }
      finally {
        server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
        await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    }
  });
}
