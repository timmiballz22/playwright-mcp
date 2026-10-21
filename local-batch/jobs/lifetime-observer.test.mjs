import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createLifetimeObserver } from './fixtures/lifetime-observer.mjs';
test('live factory facts retain an owned orphan after its worker exits', { timeout: 30000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'factory-orphan-'));
  const control = path.join(root, 'control'); const observer = await createLifetimeObserver(control);
  let primary; let accepted = false;
  try {
    const outcomes = await observer.run([{ workflow: { timeoutMs: 15000, steps: [{ type: 'waitFor', selector: '#never' }] }, options: {
      artifactsDir: path.join(root, 'artifacts'), workerModule: new URL('./fixtures/lifetime-orphan-worker.mjs', import.meta.url),
    } }]);
    assert.equal(outcomes[0].status, 'fulfilled');
    assert.equal(outcomes[0].value.reason, 'cleanup_failed'); assert.equal(outcomes[0].value.retrySafe, false);
    const file = (await readdir(control)).find(file => file.endsWith('.ready.json'));
    const record = JSON.parse(await readFile(path.join(control, file), 'utf8'));
    assert.equal(await readFile(path.join(control, record.runId + '.released-alive'), 'utf8'), 'alive');
    await assert.rejects(observer.audit('deliberate_orphan'), error => {
      assert.ok(Array.isArray(error.actual) && error.actual.includes(record.browserPid), 'A real owned orphan must remain in the audit');
      return true;
    });
    console.log(JSON.stringify({ fixture: 'factory_lifetime_orphan', detected: true, cleanup: outcomes[0].value.execution.cleanup }));
    accepted = true;
  } catch (error) { primary = error; throw error; }
  finally {
    let teardown;
    try {
      for (const entry of await readdir(control, { withFileTypes: true })) if (entry.isDirectory())
        await writeFile(path.join(control, entry.name, 'stop-child'), '', { mode: 0o600 });
      const end = performance.now() + 8000; let empty = false;
      do {
        try { await observer.audit('self_exit'); empty = true; break; }
        catch (error) { if (error.code !== 'ERR_ASSERTION') throw error; }
        await new Promise(resolve => setTimeout(resolve, 20));
      } while (performance.now() < end);
      assert.equal(empty, true, 'Controlled orphan must acknowledge its private self-exit request');
    } catch (error) { teardown = error; }
    try { await observer.close(); }
    catch (error) { teardown = teardown ? new AggregateError([teardown, error], 'Lifetime teardown failed') : error; }
    if (teardown) { if (primary) throw new AggregateError([primary, teardown], 'Lifetime fault and teardown failed'); throw teardown; }
    if (accepted) await rm(root, { recursive: true, force: true });
  }
});

test('capture publication failure still releases its assigned factory gate and preserves the collision', { timeout: 30000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'factory-collision-'));
  const control = path.join(root, 'control');
  const previous = process.env.PLAYWRIGHT_TEST_LIFETIME_COLLISION; process.env.PLAYWRIGHT_TEST_LIFETIME_COLLISION = '1';
  const observer = await createLifetimeObserver(control); let accepted = false; let primary; let closeAttempted = false;
  try {
    await assert.rejects(observer.run([{ workflow: { timeoutMs: 15000, steps: [{ type: 'waitFor', selector: '#never' }] }, options: {
      artifactsDir: path.join(root, 'artifacts'), workerModule: new URL('./fixtures/lifetime-orphan-worker.mjs', import.meta.url),
    } }]), { code: 'EEXIST' });
    const file = (await readdir(control)).find(file => file.endsWith('.ready.json'));
    const record = JSON.parse(await readFile(path.join(control, file), 'utf8'));
    await writeFile(path.join(control, record.runId, 'stop-child'), '', { mode: 0o600 });
    const ackEnd = performance.now() + 5000; let acknowledged = false;
    do {
      try { acknowledged = await readFile(path.join(control, record.runId + '.child-exited'), 'utf8') === 'exited'; } catch {}
      if (!acknowledged) await new Promise(resolve => setTimeout(resolve, 20));
    } while (!acknowledged && performance.now() < ackEnd);
    assert.equal(acknowledged, true, 'Actual child handle must acknowledge exit before gate release');
    let closeError;
    closeAttempted = true;
    try { await observer.close(); } catch (error) { closeError = error; }
    assert.ok((await readdir(control)).includes(record.runId + '.release'), 'Assigned capability must be released even when capture publication fails');
    assert.equal(closeError, undefined);
    assert.equal(await readFile(path.join(control, record.runId + '.identities.json'), 'utf8'), 'preserve-factory-collision');
    accepted = true;
  } catch (error) { primary = error; throw error; }
  finally {
    let teardown;
    try {
      for (const file of (await readdir(control)).filter(file => file.endsWith('.ready.json'))) {
        const record = JSON.parse(await readFile(path.join(control, file), 'utf8'));
        await writeFile(path.join(control, record.runId, 'stop-child'), '', { mode: 0o600 });
        await writeFile(path.join(control, record.runId + '.release'), '', { mode: 0o600 });
      }
      const end = performance.now() + 8000; let empty = false;
      do {
        try { await observer.audit('collision_teardown'); empty = true; break; }
        catch (error) { if (error.code !== 'ERR_ASSERTION') throw error; }
        await new Promise(resolve => setTimeout(resolve, 20));
      } while (performance.now() < end);
      assert.equal(empty, true);
    } catch (error) { teardown = error; }
    finally {
      try { if (!closeAttempted) await observer.close(); }
      catch (error) { teardown = teardown ? new AggregateError([teardown, error], 'Collision teardown failed') : error; }
      if (previous === undefined) delete process.env.PLAYWRIGHT_TEST_LIFETIME_COLLISION;
      else process.env.PLAYWRIGHT_TEST_LIFETIME_COLLISION = previous;
    }
    if (teardown) { if (primary) throw new AggregateError([primary, teardown], 'Collision fault and teardown failed'); throw teardown; }
    if (accepted) await rm(root, { recursive: true, force: true });
  }
});
