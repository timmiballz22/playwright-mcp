import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';

test('closing a successful workflow with an outstanding allowed request is not a policy denial', async () => {
  let ready;
  const pollStarted = new Promise(resolve => { ready = resolve; });
  const fixture = createServer(async (req, res) => {
    if (req.url === '/poll') { ready(); return; }
    if (req.url === '/mark') { await pollStarted; res.end('ready'); return; }
    res.end(`<script>fetch('/poll'); fetch('/mark').then(() => { document.body.innerHTML='<p id="ready">Ready</p>' })</script>`);
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const dir = await mkdtemp(path.join(os.tmpdir(), 'routing-lifecycle-'));
  try {
    const result = await executeWorkflow({ timeoutMs: 15000, steps: [
      { type: 'goto', url: origin }, { type: 'waitFor', selector: '#ready' },
    ] }, { allowedOrigins: [origin], artifactsDir: dir });
    assert.equal(result.ok, true, `Successful actions reported ${result.reason}`);
  } finally { fixture.closeAllConnections(); fixture.close(); await rm(dir, { recursive: true, force: true }); }
});
