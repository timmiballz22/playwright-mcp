// Portable functional soak. For independent Linux RSS/CPU/FD sampling use
// soak-supervised.mjs; this subject's RSS includes its read-only process audits.
import { executeWorkflow } from '../local-batch/executor.mjs';
import { ownedDescendants } from '../local-batch/fixtures/process-audit.mjs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const count = Number(process.argv[2] ?? 100);
if (!Number.isInteger(count) || count < 20 || count > 100) throw new TypeError('Run count must be 20–100');
const abort = new AbortController();
const stop = () => abort.abort();
process.once('SIGINT', stop); process.once('SIGTERM', stop);
const dir = await mkdtemp(path.join(os.tmpdir(), 'batch-soak-'));
const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end(`<!doctype html><button>fresh</button><output></output><script>
    const output=document.querySelector('output');
    output.textContent=document.cookie.includes('soak-marker=')||localStorage.getItem('soak-marker')!==null?'dirty':'clean';
    document.querySelector('button').onclick=function(){document.cookie='soak-marker=seeded; SameSite=Strict; path=/';localStorage.setItem('soak-marker','seeded');this.textContent='done';output.textContent=document.cookie.includes('soak-marker=seeded')&&localStorage.getItem('soak-marker')==='seeded'?'seeded':'seed-failed'};
  </script>`);
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const rss = [];
const start = performance.now();
let safeToRemove = true;
let verifiedRuns = 0;
try {
  for (let run = 1; run <= count; run++) {
    const owned = [];
    safeToRemove = false;
    const result = await executeWorkflow({ timeoutMs: 15000, steps: [
      { type: 'goto', url: origin }, { type: 'assertText', selector: 'button', equals: 'fresh' },
      { type: 'assertText', selector: 'output', equals: 'clean' }, { type: 'click', selector: 'button' },
      { type: 'assertText', selector: 'button', equals: 'done' }, { type: 'assertText', selector: 'output', equals: 'seeded' },
    ] }, { artifactsDir: dir, allowedOrigins: [origin], signal: abort.signal,
      onEvent: event => { if (event.pid) owned.push(event.pid); },
    });
    assert.deepEqual(await ownedDescendants(owned), [], 'Owned process survived execution');
    safeToRemove = result.execution?.cleanup === 'terminated' && result.execution.tempCleanup === 'removed';
    assert.equal(result.ok, true, JSON.stringify({ run, reason: result.reason, completed: result.completed, execution: result.execution }));
    assert.equal(result.completed, 6);
    assert.equal(safeToRemove, true, 'Cleanup was not confirmed');
    verifiedRuns++;
    rss.push(process.memoryUsage().rss);
    if (run % 10 === 0) console.log(JSON.stringify({ runs: run, completed: run * 6, activeOwnedAfterEveryRun: 0,
      freshCookieAndLocalStorageVerified: true, elapsedMs: Math.round(performance.now() - start) }));
  }
  console.log(JSON.stringify({ scope: 'portable_functional_soak', os: process.platform, runs: count, completed: count * 6,
    elapsedMs: Math.round(performance.now() - start), activeOwnedAfterEveryRun: 0, freshCookieAndLocalStorageVerified: true,
    minSubjectRssIncludingAudit: Math.min(...rss), maxSubjectRssIncludingAudit: Math.max(...rss),
    note: 'No browser RSS, CPU, handle or FD bounds are established by this functional soak' }));
} finally {
  process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (safeToRemove && verifiedRuns === count) await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  else console.error('Functional soak workspace preserved: run failed or cleanup not confirmed');
}
