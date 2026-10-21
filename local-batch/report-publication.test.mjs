import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdtemp, readdir, readFile, stat, rm } from 'node:fs/promises';
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { saveReport } from './report.mjs';

test('a report target created during its temporary write is never replaced', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'report-publication-race-'));
  const originalWrite = fs.writeFile; const originalOpen = fs.open; let target;
  try {
    mock.method(fs, 'open', async (filename, ...args) => {
      const file = await originalOpen(filename, ...args);
      const basename = path.basename(String(filename));
      if (/^\.run-[0-9a-f-]+\.tmp$/.test(basename)) {
        target = path.join(directory, basename.slice(1, -4) + '.json');
        await originalWrite(target, 'competing-owned-report', { flag: 'wx' });
      }
      return file;
    });
    syncBuiltinESMExports();
    await assert.rejects(saveReport({ ok: true, results: [] }, directory), { code: 'EEXIST' });
    assert.equal(await readFile(target, 'utf8'), 'competing-owned-report');
    assert.deepEqual(await readdir(directory), [path.basename(target)]);
  } finally { mock.restoreAll(); syncBuiltinESMExports(); await rm(directory, { recursive: true, force: true }); }
});

test('published report is complete and its returned step summary remains bounded', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'report-publication-'));
  try {
    const results = Array.from({ length: 20 }, (_, index) => ({ index, type: 'click', ok: true }));
    const summary = await saveReport({ ok: true, results }, directory);
    assert.deepEqual(summary.recentSteps, results.slice(-10)); assert.equal(summary.results, undefined);
    assert.deepEqual(JSON.parse(await readFile(summary.reportPath, 'utf8')), { ok: true, results });
    assert.equal((await stat(summary.reportPath)).nlink, 1);
    if (process.platform !== 'win32') assert.equal((await stat(summary.reportPath)).mode & 0o777, 0o600);
    assert.deepEqual(await readdir(directory), [path.basename(summary.reportPath)]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('exclusive temporary-name collision preserves the file this report did not create', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'report-temp-collision-'));
  const id = '11111111-1111-4111-8111-111111111111';
  const temporary = path.join(directory, '.run-' + id + '.tmp');
  try {
    await fs.writeFile(temporary, 'unowned-marker', { flag: 'wx' });
    mock.method(crypto, 'randomUUID', () => id); syncBuiltinESMExports();
    await assert.rejects(saveReport({ ok: true, results: [] }, directory), { code: 'EEXIST' });
    assert.equal(await readFile(temporary, 'utf8'), 'unowned-marker');
    assert.deepEqual(await readdir(directory), [path.basename(temporary)]);
  } finally { mock.restoreAll(); syncBuiltinESMExports(); await rm(directory, { recursive: true, force: true }); }
});
