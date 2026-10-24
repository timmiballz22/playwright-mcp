import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';

for (const browser of ['chromium', 'firefox', 'webkit']) {
  test(`${browser}: popup requests obey the operator origin policy with an approved positive control`, { timeout: 45000 }, async () => {
    let hits = 0;
    const target = createServer((_request, response) => {
      hits++; response.writeHead(200, { 'Access-Control-Allow-Origin': '*' }); response.end('owned target');
    });
    target.listen(0, '127.0.0.1'); await once(target, 'listening');
    const destination = `http://127.0.0.1:${target.address().port}`;
    const fixture = createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(request.url === '/popup'
        ? `<!doctype html><title>Owned popup</title><script>fetch('${destination}/effect').catch(()=>{}).finally(()=>{opener.document.querySelector('output').id='ready'})</script>`
        : '<!doctype html><button onclick="window.open(\'/popup\')">Open popup</button><output>Waiting</output>');
    });
    fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const root = await mkdtemp(path.join(os.tmpdir(), 'popup-policy-'));
    try {
      for (const control of [true, false]) {
        const result = await executeWorkflow({ browser, timeoutMs: 18000, steps: [
          { type: 'goto', url: origin }, { type: 'click', selector: 'button' }, { type: 'waitFor', selector: '#ready' },
        ] }, { artifactsDir: root, allowedOrigins: control ? [origin, destination] : [origin] });
        assert.equal(result.ok, control, JSON.stringify({ control, result }));
        assert.equal(result.completed, 3, 'Popup must actually attempt and settle its request');
        if (!control) assert.equal(result.reason, 'policy_blocked');
        assert.equal(hits, 1, 'Only the approved positive control may reach the target');
        assert.equal(result.execution.cleanup, 'terminated');
        assert.equal(result.execution.tempCleanup, 'removed');
      }
    } finally {
      fixture.closeAllConnections(); target.closeAllConnections();
      await Promise.all([new Promise(resolve => fixture.close(resolve)), new Promise(resolve => target.close(resolve))]);
      await rm(root, { recursive: true, force: true });
    }
  });
}
