import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';
import { ownedDescendants } from './fixtures/process-audit.mjs';

test('20 supervised concurrent screenshots keep unique reports and unchanged PNGs', { timeout: 60000 }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'supervised-artifacts-'));
  const files = new Map();
  const reports = new Set();
  let verified = false;
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  try {
    for (let pair = 1; pair <= 10; pair++) {
      const owned = [];
      const sinceMs = Date.now();
      const outcomes = await Promise.allSettled([0, 1].map(() => executeWorkflow({ timeoutMs: 15000,
        steps: [{ type: 'screenshot' }] }, { artifactsDir: directory, allowSensitiveArtifacts: true, signal: t.signal,
        onEvent: event => { if (event.pid) owned.push(event.pid); },
      })));
      let auditReceipt = null;
      const survivors = await ownedDescendants(owned, { sinceMs, onReceipt: receipt => { auditReceipt = receipt; } });
      assert.equal(survivors.length, 0, JSON.stringify({ fixture: 'supervised_artifact_ownership', pair, audit: auditReceipt }));
      for (const outcome of outcomes) {
        if (outcome.status === 'rejected') throw outcome.reason;
        const result = outcome.value;
        assert.equal(result.ok, true, JSON.stringify({ pair, reason: result.reason, completed: result.completed,
          forced: result.execution?.forced, cleanup: result.execution?.cleanup, tempCleanup: result.execution?.tempCleanup }));
        assert.equal(result.completed, 1);
        assert.equal(result.execution.cleanup, 'terminated');
        assert.equal(result.execution.tempCleanup, 'removed');
        assert.equal(result.reportScope, 'worker_execution');
        assert.equal(reports.has(result.reportPath), false);
        reports.add(result.reportPath);
        const report = JSON.parse(await readFile(result.reportPath, 'utf8'));
        assert.equal(report.results.length, 1);
        assert.equal(report.results[0].ok, true);
        const file = report.results[0].artifact;
        const relative = path.relative(directory, file);
        assert.equal(path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep), false);
        assert.equal(files.has(file), false);
        const bytes = await readFile(file);
        assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
        const entry = await stat(file, { bigint: true });
        assert.equal(entry.nlink, 1n);
        if (process.platform !== 'win32') {
          assert.equal(entry.mode & 0o777n, 0o600n);
          assert.equal((await stat(path.dirname(file))).mode & 0o777, 0o700);
          assert.equal((await stat(result.reportPath)).mode & 0o777, 0o600);
        }
        files.set(file, { digest: digest(bytes), dev: entry.dev, ino: entry.ino, mtimeNs: entry.mtimeNs, ctimeNs: entry.ctimeNs });
      }
    }
    assert.equal(files.size, 20);
    assert.equal(reports.size, 20);
    for (const [file, original] of files) {
      const entry = await stat(file, { bigint: true });
      assert.deepEqual({ digest: digest(await readFile(file)), dev: entry.dev, ino: entry.ino, mtimeNs: entry.mtimeNs, ctimeNs: entry.ctimeNs },
        original, 'A later execution changed or replaced an earlier PNG');
    }
    verified = true;
  } finally {
    if (verified) await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    else console.error('Supervised artifact fixture workspace preserved: acceptance or cleanup not confirmed');
  }
});
