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
