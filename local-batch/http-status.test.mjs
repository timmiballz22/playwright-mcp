import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runWorkflow } from './runner.mjs';

test('HTTP errors fail navigation without replaying requests or leaking headers', async () => {
  const hits = new Map();
  const server = createServer((req, res) => {
    hits.set(req.url, (hits.get(req.url) || 0) + 1);
    res.writeHead(Number(req.url.slice(1)), { 'Retry-After': '2', 'X-Secret': 'canary-header-secret' });
    res.end('canary-body-secret');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const dir = await mkdtemp(path.join(os.tmpdir(), 'status-'));
  try {
    for (const status of [401, 403, 404, 429, 500, 503]) {
      const result = await runWorkflow({ steps: [{ type: 'goto', url: `${origin}/${status}` }] }, { allowedOrigins: [origin], artifactsDir: dir });
      assert.equal(result.ok, false, `HTTP ${status} incorrectly succeeded`);
      assert.equal(result.results[0].httpStatus, status);
      assert.equal(hits.get(`/${status}`), 1);
      assert.equal(JSON.stringify(result).includes('canary'), false, 'HTTP response secret reached summary');
      if (status === 429) {
        assert.equal(result.results[0].error, 'rate_limited');
        assert.equal(result.results[0].retryAfterMs, 2000);
      }
    }
  } finally { server.closeAllConnections(); server.close(); await rm(dir, { recursive: true, force: true }); }
});
