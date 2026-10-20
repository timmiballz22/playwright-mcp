import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readWorkflowFile } from './workflow-file.mjs';

test('file ingestion accepts UTF-8 BOM and rejects oversized, invalid UTF-8 and non-files', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'workflow-input-'));
  const file = path.join(dir, 'input.json');
  try {
    await writeFile(file, '\ufeff{"schemaVersion":1}');
    assert.deepEqual(await readWorkflowFile(file), { schemaVersion: 1 });
    await writeFile(file, '{}' + ' '.repeat(1048574));
    assert.deepEqual(await readWorkflowFile(file), {});
    await writeFile(file, Buffer.alloc(1048577, 32));
    await assert.rejects(readWorkflowFile(file), TypeError);
    await writeFile(file, Buffer.from([123, 34, 120, 34, 58, 34, 255, 34, 125]));
    await assert.rejects(readWorkflowFile(file), TypeError);
    await assert.rejects(readWorkflowFile(dir));
    if (process.platform !== 'win32') {
      const fifo = path.join(dir, 'pipe');
      execFileSync('mkfifo', [fifo]);
      await assert.rejects(readWorkflowFile(fifo), TypeError);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
