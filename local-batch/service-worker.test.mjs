import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';
test('chromium: hostile service worker registration is blocked before its script or local target is requested', { timeout: 40000 }, async () => {
  let targetHits = 0; let scriptHits = 0; const owned = [];
  const target = createServer((_request, response) => { targetHits++; response.writeHead(200, { 'Access-Control-Allow-Origin': '*' }); response.end('owned fixture'); });
  target.listen(0, '127.0.0.1'); await once(target, 'listening');
  const denied = `http://127.0.0.1:${target.address().port}`;
  const fixture = createServer((request, response) => {
    if (request.url.startsWith('/sw.js')) {
      scriptHits++; response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' });
      response.end(`self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil(fetch('${denied}/effect').then(()=>self.clients.matchAll({includeUncontrolled:true})).then(clients=>{for(const client of clients)client.postMessage('registered')})));`); return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(`<!doctype html><output>waiting</output><script>
      const output=document.querySelector('output');
      if(!('serviceWorker' in navigator)){output.id='unavailable';output.textContent='unavailable'}else{
        navigator.serviceWorker.onmessage=()=>{output.id='registered';output.textContent='registered'};
        navigator.serviceWorker.register('/sw.js').then(registration=>{if(!registration){output.id='blocked';output.textContent='blocked'}}).catch(()=>{output.id='blocked';output.textContent='blocked'});
      }</script>`);
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const root = await mkdtemp(path.join(os.tmpdir(), 'service-worker-policy-'));
  try {
    for (const control of [true, false]) {
      const state = control ? 'registered' : 'blocked';
      const result = await executeWorkflow({ timeoutMs: 15000, steps: [{ type: 'goto', url: origin }, { type: 'waitFor', selector: '#' + state }, { type: 'assertText', selector: 'output', equals: state }] }, {
        artifactsDir: root, allowedOrigins: control ? [origin, denied] : [origin],
        ...(control ? { workerModule: new URL('./fixtures/service-worker-control.mjs', import.meta.url) } : {}),
        onEvent: event => { if (event.pid) owned.push(event.pid); },
      });
      assert.equal(result.ok, true, JSON.stringify({ control, scriptHits, targetHits, result })); assert.equal(result.completed, 3);
      assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
      assert.equal(targetHits, 1, 'Only the approved positive control may reach the target');
      assert.equal(scriptHits, 1, 'Strict configuration must not fetch the worker script');
    }
  } finally {
    let clean = false;
    try { assert.deepEqual(await ownedDescendants(owned), []); clean = true; }
    finally {
      fixture.closeAllConnections(); target.closeAllConnections();
      await Promise.all([new Promise(resolve => fixture.close(resolve)), new Promise(resolve => target.close(resolve))]);
      if (clean) await rm(root, { recursive: true, force: true });
    }
  }
});
