import { runWorkflow } from '../local-batch/runner.mjs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir = await mkdtemp(path.join(os.tmpdir(), 'batch-soak-'));
const server = createServer((req, res) => res.end('<button onclick="this.textContent=\'done\'">fresh</button>'));
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const rss = [];
const start = performance.now();
try {
  for (let i = 0; i < 100; i++) {
    const result = await runWorkflow({ steps: [{ type: 'goto', url: origin }, { type: 'assertText', selector: 'button', contains: 'fresh' }, { type: 'click', selector: 'button' }, { type: 'assertText', selector: 'button', contains: 'done' }] }, { artifactsDir: dir, allowedOrigins: [origin] });
    assert.equal(result.ok, true, JSON.stringify(result));
    global.gc?.();
    rss.push(process.memoryUsage().rss);
    if ((i + 1) % 10 === 0) console.log(JSON.stringify({ runs: i + 1, rss: rss.at(-1), elapsedMs: Math.round(performance.now() - start) }));
  }
  console.log(JSON.stringify({ runs: 100, elapsedMs: Math.round(performance.now() - start), minRunnerRss: Math.min(...rss), maxRunnerRss: Math.max(...rss), note: 'Runner RSS only; browser process-tree memory and descriptor leak bounds remain unverified' }));
} finally { server.close(); await rm(dir, { recursive: true, force: true }); }
