// Linux-only real Chromium soak, with an independent read-only observer.
// Subject memory excludes process-table/procfs sampler allocations.
import assert from 'node:assert/strict';
import { fork, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { ownedDescendants } from '../local-batch/fixtures/process-audit.mjs';
if (process.platform !== 'linux') throw new Error('Linux procfs measurement required; no cross-OS pass is implied');
const count = Number(process.argv[2] ?? 100);
if (!Number.isInteger(count) || count < 20 || count > 100) throw new TypeError('Run count must be 20–100');
const clockTicks = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim());
assert.ok(Number.isFinite(clockTicks) && clockTicks > 0);
const start = performance.now(); const observerCpuStart = process.cpuUsage();
const records = []; let current; let baselineFd; let failure; let subjectCpuMs; let finished = false;
const subject = fork(fileURLToPath(new URL('./soak-subject.mjs', import.meta.url)), [String(count)], {
  stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: [], windowsHide: true,
});
const exit = once(subject, 'exit'); void exit.catch(() => {});
const ack = run => { if (subject.connected) subject.send({ type: 'ack', run }, error => { if (error) failure ??= new Error('subject_ipc_failed'); }); };
const stop = () => { if (subject.connected) subject.disconnect(); };
process.once('SIGINT', stop); process.once('SIGTERM', stop);
const quantile = (values, q) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * q) - 1)];
async function sample(state) {
  const pids = await ownedDescendants([...state.roots, ...state.seen]);
  let rss = 0; let fds = 0;
  for (const pid of pids) {
    state.seen.add(pid);
    try {
      const [stat, status, descriptors] = await Promise.all([
        readFile(`/proc/${pid}/stat`, 'utf8'), readFile(`/proc/${pid}/status`, 'utf8'),
        readdir(`/proc/${pid}/fd`).catch(error => {
          if (error.code === 'EACCES' || error.code === 'EPERM') return null;
          throw error;
        }),
      ]);
      const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
      const identity = pid + ':' + fields[19];
      const ticks = Number(fields[11]) + Number(fields[12]);
      assert.ok(Number.isSafeInteger(ticks) && ticks >= 0);
      state.cpu.set(identity, Math.max(state.cpu.get(identity) ?? 0, ticks));
      rss += Number(status.match(/^VmRSS:\s+(\d+) kB$/m)?.[1] ?? 0) * 1024;
      if (descriptors) fds += descriptors.length;
      else state.inaccessibleFds.add(identity);
    } catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error; }
  }
  state.samples++;
  state.peakRss = Math.max(state.peakRss, rss); state.peakFds = Math.max(state.peakFds, fds);
  state.peakProcesses = Math.max(state.peakProcesses, pids.length);
}
function poll(state) {
  if (state.sampling || state.error) return;
  state.sampling = sample(state).catch(error => { state.error = error; }).finally(() => { state.sampling = undefined; });
}
async function message(packet) {
  if (packet.type === 'ready') { baselineFd = packet.baselineFds; ack(0); }
  if (packet.type === 'runStart') {
    assert.equal(current, undefined);
    current = { run: packet.run, roots: new Set(), seen: new Set(), cpu: new Map(), inaccessibleFds: new Set(),
      samples: 0, peakRss: 0, peakFds: 0, peakProcesses: 0 };
    const state = current;
    state.timer = setInterval(() => poll(state), 50);
    ack(packet.run);
  }
  if (packet.type === 'owned' && packet.run === current?.run) {
    current.roots.add(packet.pid); current.seen.add(packet.pid); poll(current);
  }
  if (packet.type === 'runDone') {
    const state = current; assert.equal(packet.run, state?.run);
    clearInterval(state.timer); await state.sampling;
    assert.equal(state.error, undefined, 'Process sampling failed');
    assert.deepEqual(await ownedDescendants([...state.roots, ...state.seen]), [], 'Owned processes survived completed execution');
    assert.ok(state.samples > 0 && state.peakRss > 0 && state.peakProcesses > 0, 'Owned process measurement missing');
    const row = { ...packet.row, peakSampledTreeRss: state.peakRss, peakSampledReadableTreeFds: state.peakFds,
      treeFdCoverage: state.inaccessibleFds.size ? 'partial_permission_denied' : 'sampled',
      inaccessibleFdProcesses: state.inaccessibleFds.size, peakSampledTreeProcesses: state.peakProcesses,
      sampledCpuMsLowerBound: Math.round([...state.cpu.values()].reduce((a, b) => a + b, 0) / clockTicks * 1000),
      samples: state.samples, activeOwnedAfterRun: 0 };
    records.push(row); console.log(JSON.stringify(row)); current = undefined; ack(packet.run);
  }
  if (packet.type === 'done') { subjectCpuMs = packet.cpuMs; finished = true; }
  if (packet.type === 'failed') throw new Error('soak_subject_failed');
}
subject.on('message', packet => { void message(packet).catch(error => { failure ??= error; stop(); }); });
console.log(JSON.stringify({ kind: 'environment', mode: 'supervised_source_separate_observer', node: process.versions.node,
  os: os.platform(), kernel: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model,
  availableParallelism: os.availableParallelism(), hostMemoryBytes: os.totalmem(), clockTicks,
  sampleIntervalMs: 50, runs: count, gcForced: false, subjectHeapCap: 'Node default',
  modelTurns: 0, mcpToolCalls: 0, tokensMeasured: false }));
try {
  const [code] = await exit;
  if (failure) throw failure;
  assert.equal(code, 0); assert.equal(finished, true); assert.equal(records.length, count);
  const cpu = process.cpuUsage(observerCpuStart);
  const warm = records.slice(10, Math.min(20, records.length)); const last = records.slice(-10);
  const rssGrowth = quantile(last.map(row => row.subjectRss), 0.5) - quantile(warm.map(row => row.subjectRss), 0.5);
  const finalFd = records.at(-1).subjectFds;
  const passed = finalFd <= baselineFd + 4 && rssGrowth <= 32 * 1024 * 1024;
  console.log(JSON.stringify({ kind: 'summary', runs: records.length, actions: records.length * 4, elapsedMs: Math.round(performance.now() - start),
    medianRunMs: quantile(records.map(row => row.durationMs), 0.5), p95RunMs: quantile(records.map(row => row.durationMs), 0.95),
    peakSampledTreeRss: Math.max(...records.map(row => row.peakSampledTreeRss)),
    peakSampledReadableTreeFds: Math.max(...records.map(row => row.peakSampledReadableTreeFds)),
    treeFdCoverage: records.some(row => row.inaccessibleFdProcesses) ? 'partial_permission_denied' : 'sampled',
    inaccessibleFdProcesses: records.reduce((sum, row) => sum + row.inaccessibleFdProcesses, 0),
    peakSampledTreeProcesses: Math.max(...records.map(row => row.peakSampledTreeProcesses)),
    subjectCpuMs, observerCpuMs: Math.round((cpu.user + cpu.system) / 1000),
    sampledTreeCpuMsLowerBound: records.reduce((sum, row) => sum + row.sampledCpuMsLowerBound, 0),
    baselineSubjectFds: baselineFd, finalSubjectFds: finalFd, subjectMedianRssGrowthAfterWarmup: rssGrowth,
    subjectRssGrowthBudgetBytes: 32 * 1024 * 1024, subjectFdGrowthBudget: 4,
    activeOwnedAfterEveryRun: 0, thresholdsPassed: passed, sampleIntervalMs: 50,
    limitations: 'Separate observer. Sampled summed RSS double-counts shared pages; peaks/child CPU are lower bounds. Browser FD coverage can be partial. Instrumentation affects latency. No MCP/token or cross-OS benchmark.', modelTurns: 0 }));
  assert.equal(passed, true, 'Predetermined soak resource thresholds exceeded');
} finally {
  process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  if (current) { clearInterval(current.timer); await current.sampling; }
  stop();
  if (subject.exitCode === null && subject.signalCode === null) {
    let timer;
    const exited = await Promise.race([exit.then(() => true, () => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 10000); })]);
    clearTimeout(timer);
    if (!exited) { subject.kill('SIGKILL'); await exit; }
  }
  if (current) {
    const end = performance.now() + 25000;
    let survivors;
    do {
      survivors = await ownedDescendants([...current.roots, ...current.seen]);
      if (!survivors.length) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (performance.now() < end);
    assert.deepEqual(survivors, [], 'Cleanup after observer failure remains uncertain');
  }
}
