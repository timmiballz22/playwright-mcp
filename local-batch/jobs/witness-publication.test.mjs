import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { writePrivateWitness } from './fixtures/write-private-witness.mjs';

test('private witness publishes complete JSON without replacing a prior target', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'witness-publication-')); let verified = false;
  try {
    writePrivateWitness(directory, 'witness.json', { calibration: true });
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'witness.json'), 'utf8')), { calibration: true });
    const metadata = await stat(path.join(directory, 'witness.json'));
    assert.equal(metadata.nlink, 1); if (process.platform !== 'win32') assert.equal(metadata.mode & 0o777, 0o600);
    assert.throws(() => writePrivateWitness(directory, 'witness.json', { replaced: true }), { code: 'EEXIST' });
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'witness.json'), 'utf8')), { calibration: true });
    assert.deepEqual(await readdir(directory), ['witness.json']); verified = true;
  } finally {
    if (verified) await rm(directory, { recursive: true, force: true });
    else console.error(JSON.stringify({ fixture: 'witness_publication_workspace_unconfirmed', workspace: path.basename(directory) }));
  }
});

test('actual worker interruption before link cannot expose partial final witness JSON', { timeout: 10000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'witness-interrupted-'));
  const child = fork(fileURLToPath(new URL('./fixtures/interrupted-witness.mjs', import.meta.url)), [directory], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let closeObserved = false, verified = false, primary, timer;
  const closed = new Promise(resolve => child.once('close', () => { closeObserved = true; resolve(); }));
  const message = new Promise((resolve, reject) => { child.once('message', resolve); child.once('error', reject); });
  try {
    const receipt = await Promise.race([message, closed.then(() => { throw new Error('Witness worker exited before publication boundary'); }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Witness boundary unavailable')), 3000); })]);
    clearTimeout(timer); assert.equal(receipt.stage, 'before_link'); assert.equal(receipt.targetAbsent, true); assert.deepEqual(receipt.value, { calibration: true });
    assert.match(receipt.temporary, /^\.witness-[a-f0-9-]+\.tmp$/);
    assert.equal(child.kill('SIGKILL'), true); await closed;
    await assert.rejects(stat(path.join(directory, 'witness.json')), { code: 'ENOENT' });
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, receipt.temporary), 'utf8')), { calibration: true });
    console.log(JSON.stringify({ fixture: 'witness_interruption_observed', processCloseObserved: closeObserved, finalPublished: false, temporaryComplete: true }));
    verified = true;
  } catch (error) { primary = error; throw error; }
  finally {
    clearTimeout(timer); let cleanup;
    try {
      if (!closeObserved) child.kill('SIGKILL');
      await Promise.race([closed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Owned witness worker close unconfirmed')), 2000); })]);
      if (verified) await rm(directory, { recursive: true, force: true });
    } catch (error) { cleanup = error; }
    finally { clearTimeout(timer); }
    if (!verified || cleanup) console.error(JSON.stringify({ fixture: 'witness_publication_workspace_unconfirmed', workspace: path.basename(directory), processCloseObserved: closeObserved }));
    if (cleanup) throw primary ? new AggregateError([primary, cleanup], 'Witness interruption and cleanup failed', { cause: primary }) : cleanup;
  }
});
