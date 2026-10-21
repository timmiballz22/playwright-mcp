import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';

for (const browser of ['chromium', 'firefox', 'webkit']) {
for (const family of ['ipv4', 'ipv6']) {
  test(`${browser}: canonical ${family === 'ipv4' ? 'localhost' : 'IPv6 loopback'} aliases cannot escape an unapproved port`, { timeout: 45000 }, async () => {
    let hits = 0;
    const target = createServer((_request, response) => { hits++; response.writeHead(200, { 'Access-Control-Allow-Origin': '*' }); response.end('owned control'); });
    target.listen({ port: 0, host: family === 'ipv4' ? '127.0.0.1' : '::1', ipv6Only: true }); await once(target, 'listening');
    const destination = `http://${family === 'ipv4' ? '127.0.0.1' : '[::1]'}:${target.address().port}`;
    const hosts = family === 'ipv4' ? ['127.0.0.1', '2130706433', '0x7f000001', '0177.0.0.1', '127.1', '%31%32%37.0.0.1'] :
      ['[::1]', '[0:0:0:0:0:0:0:1]', '[::0:1]', '[0000:0000:0000:0000:0000:0000:0000:0001]'];
    const urls = hosts.map((host, index) => `http://${host}:${target.address().port}/effect?case=${index}`);
    const fixture = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(`<!doctype html><button onclick="run()">Run aliases</button><output>Waiting</output><script>
        function run(){Promise.all(${JSON.stringify(urls)}.map(url=>fetch(url).then(()=>true,()=>false))).then(results=>{const output=document.querySelector('output');output.id='ready';output.textContent=results.filter(Boolean).length})}
      </script>`);
    });
    fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const root = await mkdtemp(path.join(os.tmpdir(), 'encoded-origin-')); let verified = false;
    try {
      for (const control of [true, false]) {
        const result = await executeWorkflow({ browser, timeoutMs: 18000, steps: [
          { type: 'goto', url: origin }, { type: 'click', selector: 'button' }, { type: 'waitFor', selector: '#ready' },
          { type: 'assertText', selector: 'output', equals: control ? String(urls.length) : '0' },
        ] }, { artifactsDir: root, allowedOrigins: control ? [origin, destination] : [origin] });
        assert.equal(result.ok, control, JSON.stringify({ control, result }));
        assert.equal(result.completed, 4, 'All browser alias requests must actually settle');
        assert.equal(hits, urls.length, 'Only explicitly approved control requests may reach the target');
        if (!control) assert.equal(result.reason, 'policy_blocked', JSON.stringify({ control, hits, result }));
        assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
      }
      verified = true;
    } finally {
      fixture.closeAllConnections(); target.closeAllConnections();
      await Promise.all([new Promise(resolve => fixture.close(resolve)), new Promise(resolve => target.close(resolve))]);
      if (verified) await rm(root, { recursive: true, force: true });
    }
  });
}
}
