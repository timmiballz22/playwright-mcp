import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { executeWorkflow } from './executor.mjs';

test('partial report write failure preserves completed actions and publishes no corrupt JSON', { timeout: 15000 }, async () => {
  let navigations = 0;
  const fixture = createServer((req, res) => { if (req.url === '/') navigations++; res.end('<button>Ready</button>'); });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const dir = await mkdtemp(path.join(os.tmpdir(), 'report-failure-'));
  try {
    const result = await executeWorkflow({ steps: [{ type: 'goto', url: origin }, { type: 'waitFor', selector: 'button', repeat: 4 }] }, {
      artifactsDir: dir, allowedOrigins: [origin], workerModule: new URL('./fixtures/report-error-worker.mjs', import.meta.url),
    });
    assert.equal(result.ok, false);
    assert.equal(result.stage, 'report');
    assert.equal(result.completed, 5, 'Already executed actions must not be reported as unstarted');
    assert.equal(result.reportPath, null);
    assert.equal(result.retrySafe, false);
    assert.equal(result.completionCertainty, 'confirmed_lower_bound');
    assert.equal(navigations, 1, 'Reporting failure replayed an already executed navigation');
    assert.equal(JSON.stringify(result).includes('fake-report-secret'), false, 'Report exception leaked sensitive diagnostic text');
    const files = await readdir(path.join(dir, 'exec-' + result.runId));
    assert.equal(files.some(file => /^\.?run-[0-9a-f-]+\.(json|tmp)$/.test(file)), false, 'A partial report was published or retained');
  } finally {
    fixture.closeAllConnections(); fixture.close(); await rm(dir, { recursive: true, force: true });
  }
});
