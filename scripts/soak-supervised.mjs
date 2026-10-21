// Linux-only, real local Chromium, fresh independently supervised execution/run.
// Read-only process sampling; ownership comes from child events, never disk PIDs.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from '../local-batch/executor.mjs';
import { ownedDescendants } from '../local-batch/fixtures/process-audit.mjs';

if (process.platform !== 'linux') throw new Error('Linux procfs measurement required; no cross-OS pass is implied');
const count = Number(process.argv[2] ?? 100);
if (!Number.isInteger(count) || count < 20 || count > 100) throw new TypeError('Run count must be 20–100');
const clockTicks = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim());
assert.ok(Number.isFinite(clockTicks) && clockTicks > 0);
const directory = await mkdtemp(path.join(os.tmpdir(), 'supervised-soak-'));
const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end('<!doctype html><button onclick="this.textContent=\'done\'">fresh</button>');
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const abort = new AbortController();
const stop = () => abort.abort();
process.once('SIGINT', stop); process.once('SIGTERM', stop);
const parentCpuStart = process.cpuUsage();
const start = performance.now();
const records = [];
let allClean = true;
let currentOwned = new Set();
const parentFd = async () => (await readdir('/proc/self/fd')).length;
const baselineFd = await parentFd();
const quantile = (values, q) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * q) - 1)];
console.log(JSON.stringify({ kind: 'environment', mode: 'supervised_source', node: process.versions.node,
  os: os.platform(), kernel: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model,
  availableParallelism: os.availableParallelism(), hostMemoryBytes: os.totalmem(),
  clockTicks, sampleIntervalMs: 50, runs: count, gcForced: false, modelTurns: 0, mcpToolCalls: 0 }));
try {
  for (let run = 1; run <= count; run++) {
    const roots = new Set(); currentOwned = new Set();
    const cpuTicks = new Map();
    const inaccessibleFdProcesses = new Set();
    let sampling; let sampleError; let sampleCount = 0;
    let peakTreeRss = 0; let peakTreeFds = 0; let peakTreeProcesses = 0;
    const sample = async () => {
      const pids = await ownedDescendants([...roots, ...currentOwned]);
      let rss = 0; let fds = 0;
      for (const pid of pids) {
        currentOwned.add(pid);
        try {
          const [stat, status, descriptors] = await Promise.all([
            readFile(`/proc/${pid}/stat`, 'utf8'), readFile(`/proc/${pid}/status`, 'utf8'),
            readdir(`/proc/${pid}/fd`).catch(error => {
              if (error.code === 'EACCES' || error.code === 'EPERM') return null;
              throw error;
            }),
          ]);
          const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
          const identity = pid + ':' + fields[19]; // PID + kernel process start ticks
          const ticks = Number(fields[11]) + Number(fields[12]);
          assert.ok(Number.isSafeInteger(ticks) && ticks >= 0);
          cpuTicks.set(identity, Math.max(cpuTicks.get(identity) ?? 0, ticks));
          rss += Number(status.match(/^VmRSS:\s+(\d+) kB$/m)?.[1] ?? 0) * 1024;
          if (descriptors) fds += descriptors.length;
          else inaccessibleFdProcesses.add(identity);
        } catch (error) {
          if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error;
        }
      }
      sampleCount++;
      peakTreeRss = Math.max(peakTreeRss, rss);
      peakTreeFds = Math.max(peakTreeFds, fds);
      peakTreeProcesses = Math.max(peakTreeProcesses, pids.length);
    };
    const poll = () => {
      if (sampling || sampleError) return;
      sampling = sample().catch(error => { sampleError = error; }).finally(() => { sampling = undefined; });
    };
    const timer = setInterval(poll, 50);
    let result;
    try {
      result = await executeWorkflow({ timeoutMs: 15000, steps: [
        { type: 'goto', url: origin }, { type: 'assertText', selector: 'button', equals: 'fresh' },
        { type: 'click', selector: 'button' }, { type: 'assertText', selector: 'button', equals: 'done' },
      ] }, { allowedOrigins: [origin], artifactsDir: directory, signal: abort.signal,
        onEvent: event => { if (event.pid) { roots.add(event.pid); currentOwned.add(event.pid); poll(); } },
      });
    } finally { clearInterval(timer); await sampling; }
    const survivors = await ownedDescendants([...roots, ...currentOwned]);
    allClean = survivors.length === 0;
    assert.deepEqual(survivors, [], 'Owned processes survived completed execution');
    assert.equal(sampleError, undefined, 'Process sampling failed');
    assert.equal(result.ok, true, JSON.stringify({ reason: result.reason, completed: result.completed, execution: result.execution }));
    assert.equal(result.completed, 4); assert.equal(result.execution.cleanup, 'terminated');
    assert.equal(result.execution.tempCleanup, 'removed');
    assert.ok(sampleCount > 0 && peakTreeProcesses > 0 && peakTreeRss > 0, 'Owned process measurement missing');
    await new Promise(resolve => setImmediate(resolve));
    const memory = process.memoryUsage();
    const row = { run, durationMs: result.durationMs, parentRss: memory.rss, parentHeapUsed: memory.heapUsed,
      parentFds: await parentFd(), peakSampledTreeRss: peakTreeRss, peakSampledReadableTreeFds: peakTreeFds, treeFdCoverage: inaccessibleFdProcesses.size ? 'partial_permission_denied' : 'sampled',
      inaccessibleFdProcesses: inaccessibleFdProcesses.size,
      peakSampledTreeProcesses: peakTreeProcesses, sampledCpuMsLowerBound: Math.round([...cpuTicks.values()].reduce((a, b) => a + b, 0) / clockTicks * 1000),
      samples: sampleCount, activeOwnedAfterRun: 0 };
    records.push(row); console.log(JSON.stringify(row));
  }
  const cpu = process.cpuUsage(parentCpuStart);
  const warm = records.slice(10, Math.min(20, records.length));
  const last = records.slice(-10);
  const rssGrowth = quantile(last.map(row => row.parentRss), 0.5) - quantile(warm.map(row => row.parentRss), 0.5);
  const finalFd = records.at(-1).parentFds;
  const passed = finalFd <= baselineFd + 4 && rssGrowth <= 32 * 1024 * 1024;
  const summary = { kind: 'summary', runs: records.length, actions: records.length * 4, elapsedMs: Math.round(performance.now() - start),
    medianRunMs: quantile(records.map(row => row.durationMs), 0.5), p95RunMs: quantile(records.map(row => row.durationMs), 0.95),
    peakSampledTreeRss: Math.max(...records.map(row => row.peakSampledTreeRss)),
    peakSampledReadableTreeFds: Math.max(...records.map(row => row.peakSampledReadableTreeFds)),
    treeFdCoverage: records.some(row => row.inaccessibleFdProcesses) ? 'partial_permission_denied' : 'sampled',
    inaccessibleFdProcesses: records.reduce((sum, row) => sum + row.inaccessibleFdProcesses, 0),
    peakSampledTreeProcesses: Math.max(...records.map(row => row.peakSampledTreeProcesses)),
    parentCpuMs: Math.round((cpu.user + cpu.system) / 1000), sampledTreeCpuMsLowerBound: records.reduce((sum, row) => sum + row.sampledCpuMsLowerBound, 0),
    baselineParentFds: baselineFd, finalParentFds: finalFd, parentMedianRssGrowthAfterWarmup: rssGrowth,
    parentRssGrowthBudgetBytes: 32 * 1024 * 1024, parentFdGrowthBudget: 4,
    activeOwnedAfterEveryRun: 0, thresholdsPassed: passed, sampleIntervalMs: 50,
    limitations: 'Sampled summed RSS double-counts shared pages; peaks and child CPU are lower bounds. Parent CPU excludes ps helpers. Browser FD counts are incomplete when kernel access is denied. Instrumentation affects latency. No MCP/token or cross-OS benchmark.',
    modelTurns: 0 };
  console.log(JSON.stringify(summary));
  assert.equal(passed, true, 'Predetermined soak resource thresholds exceeded');
} finally {
  process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  if (allClean && !(await ownedDescendants([...currentOwned])).length)
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
