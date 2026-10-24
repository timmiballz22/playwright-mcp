/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, expect } from './fixtures';

test('original stdio drains substantial stderr before MCP initialization', async ({ startClient }) => {
  const preload = pathToFileURL(path.join(__dirname, 'fixtures/stderr-flood.mjs')).href;
  // Private negative calibration changes the producer only. Assertions and
  // teardown remain identical; overflow must fail, never silently truncate.
  const bytes = process.env.PLAYWRIGHT_TEST_STDERR_OVERFLOW === '1' ? '1048577' : '983040';
  const { client, stderr, ...extra } = await startClient({ env: {
    NODE_OPTIONS: [process.env.NODE_OPTIONS, '--import=' + preload].filter(Boolean).join(' '),
    PLAYWRIGHT_TEST_STDERR_BYTES: bytes,
  } });
  expect((await client.listTools()).tools.some(tool => tool.name === 'browser_navigate')).toBe(true);
  const info = (extra as any).stderrInfo;
  console.log(JSON.stringify({ fixture: 'original_stderr_budget_probe',
    ...(typeof info === 'function' ? info() : { retainedBytes: Buffer.byteLength(stderr()), overflow: false }) }));
  expect(Buffer.byteLength(stderr())).toBeGreaterThanOrEqual(Number(bytes));
  expect(stderr().includes('private-fixture-stderr-canary:')).toBe(true);
});
