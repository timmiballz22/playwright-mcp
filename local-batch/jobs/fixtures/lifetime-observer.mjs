// Checkout-only coordination for read-only ownership evidence. Observed PIDs
// never grant signal or lease-release authority. Live gates use actual handles.
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { executeWorkflow } from '../../executor.mjs';
import { ownedScopeDescendants } from '../../fixtures/process-audit.mjs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const validPid = pid => Number.isSafeInteger(pid) && pid > 1;
export async function createLifetimeObserver(directory) {
  await mkdir(directory, { mode: 0o700 });
  const previous = process.env.PLAYWRIGHT_TEST_LIFETIME_CONTROL;
  process.env.PLAYWRIGHT_TEST_LIFETIME_CONTROL = directory;
  const entries = []; const consumed = new Set(); let closed = false; let auditSequence = 0;
  async function readyRecords() {
    const files = (await readdir(directory)).filter(file => file.endsWith('.ready.json'));
    assert.ok(files.length <= 100, 'Private factory receipt bound exceeded');
    const records = [];
    for (const file of files) {
      const bytes = await readFile(path.join(directory, file));
      assert.ok(bytes.length <= 512, 'Private factory receipt byte bound exceeded');
      const record = JSON.parse(bytes.toString('utf8'));
      assert.ok(uuid.test(record.runId) && file === record.runId + '.ready.json' && validPid(record.workerPid) && validPid(record.browserPid), 'Invalid private factory receipt');
      records.push(record);
    }
    return records;
  }
  function assign(record, candidates) {
    const matches = candidates.filter(entry => entry.workerPid === record.workerPid && (!entry.runId || entry.runId === record.runId));
    assert.equal(matches.length, 1, 'Factory receipt must identify one actual worker lifetime');
    const entry = matches[0]; entry.runId = record.runId; entry.browserPid = record.browserPid;
    entry.scope.roots.add(record.browserPid);
    return entry;
  }
  async function release(runId) {
    try { await writeFile(path.join(directory, runId + '.release'), '', { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  async function audit(phase, sinceMs) {
    let receipt = null;
    let legacy = null;
    const observed = await ownedScopeDescendants(entries.map(entry => entry.scope), { sinceMs, onReceipt: value => { receipt = value; },
      compareLegacyRoots: entries.flatMap(entry => entry.factoryRoots ?? [...entry.scope.roots]),
      onLegacyObservation: value => { legacy = value; },
    });
    const facts = entries.map(entry => ({ runId: entry.runId, roots: [...entry.scope.roots], identities: [...entry.scope.identities] }));
    if (process.platform === 'win32') assert.ok(legacy, 'Same-snapshot legacy comparison missing');
    await writeFile(path.join(directory, 'audit-' + (++auditSequence) + '.json'), JSON.stringify({ phase, observed, legacy, audit: receipt, lifetimes: facts }), { flag: 'wx', mode: 0o600 });
    if (legacy?.legacyOnly.length) {
      const comparison = JSON.stringify({ fixture: 'factory_lifetime_comparison', phase, legacy, lifetimes: facts });
      assert.ok(Buffer.byteLength(comparison, 'utf8') <= 65536, 'Factory comparison receipt byte bound exceeded');
      console.log(comparison);
    }
    assert.deepEqual(observed, [], JSON.stringify({ fixture: 'factory_lifetime_ownership', phase, lifetimes: entries.length, audit: receipt }));
    console.log(JSON.stringify({ fixture: 'factory_lifetime_audit', phase, lifetimes: entries.length, observed: observed.length }));
  }
  return {
    async run(specs) {
      assert.equal(closed, false); assert.ok(specs.length > 0 && specs.length <= 2);
      const sinceMs = Date.now();
      const batch = specs.map(({ workflow, options }) => {
        const entry = { scope: { roots: new Set(), identities: new Map() }, settled: false };
        entries.push(entry);
        entry.pending = executeWorkflow(workflow, { ...options,
          workerModule: options.workerModule ?? new URL('./lifetime-gated-worker.mjs', import.meta.url),
          onEvent: event => {
            if (validPid(event.pid)) entry.scope.roots.add(event.pid);
            if (event.type === 'supervisorSpawned') entry.supervisorPid = event.pid;
            if (event.type === 'workerSpawned') entry.workerPid = event.pid;
            options.onEvent?.(event);
          },
        });
        void entry.pending.then(result => { entry.settled = true; entry.reason = result.reason; }, () => { entry.settled = true; });
        return entry;
      });
      while (batch.some(entry => !entry.runId)) {
        for (const record of await readyRecords()) {
          if (consumed.has(record.runId)) continue;
          if (batch.some(entry => entry.workerPid === record.workerPid)) assign(record, batch);
        }
        if (batch.every(entry => entry.runId)) break;
        assert.equal(batch.some(entry => entry.settled), false, 'Execution ended before live factory observation');
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      const factoryRoots = batch.map(entry => {
        const handles = [entry.supervisorPid, entry.workerPid, entry.browserPid];
        assert.ok(handles.every(validPid) && new Set(handles).size === 3, 'Three actual factory roots must be identified');
        entry.factoryRoots = [...entry.scope.roots];
        return entry.factoryRoots;
      });
      let receipt = null;
      const live = await ownedScopeDescendants(batch.map(entry => entry.scope), { rememberLiveRoots: true, sinceMs, onReceipt: value => { receipt = value; } });
      for (const roots of factoryRoots) for (const pid of roots) assert.ok(live.includes(pid), 'Every actual factory root must remain live during observation');
      console.log(JSON.stringify({ fixture: 'factory_lifetime_capture', executions: batch.length, factoryRoots: factoryRoots.flat().length, observedBeforeRelease: live.length, rememberedRootBirths: receipt?.rememberedRootBirths ?? null }));
      for (const entry of batch) {
        if (process.platform === 'win32') for (const pid of factoryRoots[batch.indexOf(entry)]) assert.ok(entry.scope.identities.has(pid), 'Live factory birth receipt missing');
        await writeFile(path.join(directory, entry.runId + '.identities.json'), JSON.stringify({ factoryRoots: factoryRoots[batch.indexOf(entry)], identities: [...entry.scope.identities], audit: receipt }), { flag: 'wx', mode: 0o600 });
        consumed.add(entry.runId); await release(entry.runId);
      }
      return Promise.allSettled(batch.map(entry => entry.pending));
    },
    audit,
    async close() {
      try {
        for (const record of await readyRecords()) {
          if (!consumed.has(record.runId)) assign(record, entries.filter(entry => !entry.runId));
          await release(record.runId);
        }
        await Promise.allSettled(entries.map(entry => entry.pending));
        await audit('teardown');
      } finally {
        closed = true;
        if (previous === undefined) delete process.env.PLAYWRIGHT_TEST_LIFETIME_CONTROL;
        else process.env.PLAYWRIGHT_TEST_LIFETIME_CONTROL = previous;
      }
    },
  };
}
