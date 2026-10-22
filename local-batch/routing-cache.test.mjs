import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLifetimeObserver } from './jobs/fixtures/lifetime-observer.mjs';

test('owned cache comparison keeps strict routing enabled and measures its repeated resource requests', { timeout: 45000 }, async () => {
  const hits = { control: 0, strict: 0 }; const receipts = [];
  let verified = false; let primary;
  const asset = 'document.querySelector("output").textContent="ready";/*' + 'x'.repeat(262144) + '*/';
  const fixture = createServer((request, response) => {
    const url = new URL(request.url, 'http://fixture'); const mode = url.searchParams.get('mode');
    if (!['control', 'strict'].includes(mode)) { response.writeHead(404); response.end(); return; }
    if (url.pathname === '/asset.js') {
      hits[mode]++; response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'public,max-age=3600' }); response.end(asset);
    } else {
      response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      response.end(`<!doctype html><output>waiting</output><script src="/asset.js?mode=${mode}"></script>`);
    }
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const directory = await mkdtemp(path.join(os.tmpdir(), 'routing-cache-'));
  const observer = await createLifetimeObserver(path.join(directory, 'factory-control'));
  try {
    for (const mode of ['control', 'strict']) {
      const workflow = { timeoutMs: 15000, steps: Array.from({ length: 6 }, () => [
        { type: 'goto', url: `${origin}/?mode=${mode}` }, { type: 'assertText', selector: 'output', equals: 'ready' },
      ]).flat() };
      const [outcome] = await observer.run([{ workflow, options: { allowedOrigins: [origin], artifactsDir: directory,
        ...(mode === 'control' ? { workerModule: new URL('./fixtures/cache-routing-control.mjs', import.meta.url) } : {}),
      } }]);
      if (outcome.status === 'rejected') throw outcome.reason;
      const result = outcome.value;
      assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.completed, 12);
      assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
      const report = JSON.parse(await readFile(result.reportPath, 'utf8'));
      const navigationMs = report.results.filter(step => step.type === 'goto').map(step => step.durationMs);
      assert.equal(navigationMs.length, 6);
      assert.equal(hits[mode], mode === 'control' ? 1 : 6);
      receipts.push({ mode, navigations: 6, assetRequests: hits[mode], assetResponseBytes: hits[mode] * Buffer.byteLength(asset), coldNavigationMs: navigationMs[0], subsequentNavigationMs: navigationMs.slice(1) });
      await observer.audit('routing_cache_' + mode);
    }
    console.log(JSON.stringify({ fixture: 'routing_cache', os: process.platform, browser: 'chromium', samplesPerMode: 1, receipts, activeOwnedProcesses: 0, modelTurns: 0 }));
    verified = true;
  } catch (error) { primary = error; throw error;
  } finally {
    let clean = false;
    try { await observer.close(); clean = true; }
    catch (error) { if (primary) throw new AggregateError([primary, error], 'Cache acceptance and lifetime audit failed'); throw error; }
    finally {
      fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
      if (clean && verified) await rm(directory, { recursive: true, force: true });
      else console.error('Routing cache fixture preserved: acceptance or cleanup not confirmed');
    }
  }
});
