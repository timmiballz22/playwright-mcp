import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';
test('operator read-only policy rejects actions and blocks page-initiated POST before effects', async () => {
  let effects = 0;
  const server = createServer((request, response) => {
    if (request.url === '/submit') { effects++; response.end('ok'); return; }
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<output>pending</output><script>fetch("/submit",{method:"POST",body:"fake-readonly-canary"}).then(()=>{document.querySelector("output").id="sent";document.querySelector("output").textContent="sent"}).catch(()=>{document.querySelector("output").id="blocked";document.querySelector("output").textContent="blocked"})</script>');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const directory = await mkdtemp(path.join(os.tmpdir(), 'read-only-'));
  try {
    let spawned = false;
    await assert.rejects(executeWorkflow({ steps: [{ type: 'click', selector: 'button' }] }, {
      readOnly: true, artifactsDir: directory, onEvent: () => { spawned = true; },
    }), TypeError);
    assert.equal(spawned, false);
    for (const readOnly of [true, false]) {
      const status = readOnly ? 'blocked' : 'sent';
      const result = await executeWorkflow({ timeoutMs: 10000, steps: [{ type: 'goto', url: origin }, { type: 'waitFor', selector: '#' + status }, { type: 'assertText', selector: 'output', equals: status }] }, {
        allowedOrigins: [origin], artifactsDir: directory, readOnly,
      });
      assert.equal(result.ok, !readOnly);
      assert.equal(result.reason, readOnly ? 'policy_blocked' : null);
      assert.equal(effects, readOnly ? 0 : 1);
      assert.equal(result.execution.cleanup, 'terminated');
      assert.equal(result.execution.tempCleanup, 'removed');
      assert.equal(JSON.stringify(result).includes('fake-readonly-canary'), false);
    }
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
});
