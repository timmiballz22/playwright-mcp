import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runWorkflow } from './runner.mjs';

test('20 real screenshots across concurrent runs have unique private directories', { timeout: 60000 }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'artifacts-'));
  const files = [];
  try {
    for (let pair = 0; pair < 10; pair++) {
      const results = await Promise.all([0, 1].map(() => runWorkflow({ steps: [{ type: 'screenshot' }] }, { artifactsDir: dir, allowSensitiveArtifacts: true })));
      for (const result of results) {
        assert.equal(result.ok, true, JSON.stringify(result));
        const file = result.results[0].artifact;
        assert.ok((await stat(file)).size > 0);
        if (process.platform !== 'win32') assert.equal((await stat(path.dirname(file))).mode & 0o777, 0o700);
        files.push(file);
      }
    }
    assert.equal(new Set(files).size, 20);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
