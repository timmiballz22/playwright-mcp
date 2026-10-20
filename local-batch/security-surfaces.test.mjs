import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';

for (const surface of ['iframe', 'websocket']) {
  test(`chromium: unapproved ${surface} never reaches the local service`, { timeout: 20000 }, async () => {
    let deniedHits = 0;
    const denied = createServer((req, res) => { deniedHits++; res.end('private'); });
    denied.on('upgrade', (req, socket) => { deniedHits++; socket.destroy(); });
    denied.listen(0, '127.0.0.1'); await once(denied, 'listening');
    const target = `127.0.0.1:${denied.address().port}`;
    const fixture = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      const html = surface === 'iframe'
        ? `<iframe src="http://${target}/" onload="document.getElementById('ready').hidden=false"></iframe>`
        : `<script>const ws=new WebSocket('ws://${target}/');ws.onerror=ws.onclose=()=>document.getElementById('ready').hidden=false;</script>`;
      res.end('<!doctype html><p id="ready" hidden>Ready</p>' + html);
    });
    fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const dir = await mkdtemp(path.join(os.tmpdir(), 'security-surface-'));
    try {
      const result = await executeWorkflow({ timeoutMs: 15000, steps: [
        { type: 'goto', url: origin }, { type: 'waitFor', selector: '#ready' },
      ] }, { allowedOrigins: [origin], artifactsDir: dir });
      assert.equal(result.reason, 'policy_blocked');
      assert.equal(result.completed, 2, 'Fixture did not observe the blocked transport');
      assert.equal(result.execution.cleanup, 'terminated');
      assert.equal(deniedHits, 0, 'Unapproved service received traffic');
    } finally {
      fixture.closeAllConnections(); fixture.close(); denied.closeAllConnections(); denied.close();
      await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
}
