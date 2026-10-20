import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runWorkflow } from './runner.mjs';

for (const browser of ['chromium', 'firefox', 'webkit']) {
  test(`${browser}: allowed origin cannot redirect to unapproved localhost port`, { timeout: 30000 }, async () => {
    let hits = 0;
    const denied = createServer((req, res) => { hits++; res.end('secret-canary'); });
    denied.listen(0, '127.0.0.1'); await once(denied, 'listening');
    const allowed = createServer((req, res) => { res.writeHead(302, { location: `http://127.0.0.1:${denied.address().port}/` }); res.end(); });
    allowed.listen(0, '127.0.0.1'); await once(allowed, 'listening');
    const origin = `http://127.0.0.1:${allowed.address().port}`;
    const dir = await mkdtemp(path.join(os.tmpdir(), 'policy-'));
    try {
      const result = await runWorkflow({ browser, steps: [{ type: 'goto', url: origin }] }, { allowedOrigins: [origin], artifactsDir: dir });
      assert.equal(result.ok, false);
      // Setup failure does not prove enforcement in a real browser.
      assert.notEqual(result.results[0]?.type, 'setup', 'browser could not launch');
      assert.equal(hits, 0);
      assert.doesNotMatch(JSON.stringify(result), /secret-canary/);
    } finally {
      allowed.close(); denied.close(); await rm(dir, { recursive: true, force: true });
    }
  });
}
