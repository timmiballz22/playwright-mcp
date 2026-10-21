import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJobArguments } from './jobs-cli.mjs';
const id = '65d8d69e-7881-443c-9cf6-c7cddf57cb49';
test('jobs CLI validates bounded commands without accepting operator policy overrides', () => {
  assert.deepEqual(parseJobArguments(['start', '--workflow', 'flow.json', '--request-key', 'key']), { command: 'start', workflow: 'flow.json', requestKey: 'key' });
  assert.equal(parseJobArguments(['result', '--job-id', id, '--wait-ms', '10000']).waitMs, 10000);
  assert.deepEqual(parseJobArguments(['cleanup', '--job-id', id]), { command: 'cleanup', jobIds: [id], dryRun: true });
  assert.equal(parseJobArguments(['cleanup', '--job-id', id, '--delete']).dryRun, false);
  for (const args of [[], ['start'], ['start', '--workflow', 'f', '--request-key', ''], ['status', '--job-id', '../bad'], ['result', '--job-id', id, '--wait-ms', '10001'], ['list', '--limit', '21'], ['list', '--owner', 'x'], ['start', '--workflow', 'f', '--request-key', 'k', '--allow-origin', 'https://x'], ['cleanup', '--job-id', id, '--job-id', id], ['status', '--job-id', id, '--delete']]) assert.throws(() => parseJobArguments(args), TypeError);
});

const { supportsJournal } = await import('./jobs/journal.mjs');
if (!supportsJournal || process.platform === 'win32') test('jobs CLI rejects unsupported execution before opening workflow or creating state', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { mkdtemp, readdir, rm } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { randomUUID } = await import('node:crypto');
  const os = await import('node:os'); const path = await import('node:path');
  const root = await mkdtemp(path.join(os.tmpdir(), 'jobs-cli-unsupported-'));
  try {
    await assert.rejects(promisify(execFile)(process.execPath, [fileURLToPath(new URL('./jobs-cli.mjs', import.meta.url)), 'start', '--workflow', 'fake-path-canary', '--request-key', 'fake-key-canary'], {
      timeout: 5000, env: { ...process.env, PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'data') },
    }), error => {
      assert.equal(error.code, 1); assert.equal(error.stdout, '');
      assert.ok(error.stderr.includes(supportsJournal ? 'unsupported_private_storage' : 'unsupported_runtime'));
      assert.equal(error.stderr.includes('fake-path-canary'), false); return true;
    });
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
