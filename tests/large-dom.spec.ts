/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import fs from 'node:fs/promises';
import { test, expect } from './fixtures';

test('original large DOM can use explicit snapshot files and bounded find without losing element actions', async ({ startClient, server }, testInfo) => {
  const rows = Array.from({ length: 4000 }, (_, index) => `<button onclick="document.querySelector('output').textContent='Activated row${index}'">Fixture row${index}</button>`).join('');
  server.setContent('/', '<!doctype html><title>Large owned DOM</title><output>Waiting</output>' + rows, 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--snapshot-mode=none'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return result.content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('\n');
  };
  expect((await call('browser_navigate', { url: server.PREFIX })).length).toBeLessThan(4096);
  const filename = testInfo.outputPath('owned-large-snapshot.md');
  const saved = await call('browser_snapshot', { filename });
  expect(saved.length).toBeLessThan(4096);
  const snapshot = await fs.readFile(filename, 'utf8');
  expect(Buffer.byteLength(snapshot)).toBeGreaterThan(65536);
  expect(snapshot.match(/button "Fixture row\d+"/g)).toHaveLength(4000);
  const limited = await call('browser_find', { text: 'Fixture row', maxResults: 1 });
  expect(limited.length).toBeLessThan(8192); expect(limited).not.toContain('Fixture row3999');
  const last = await call('browser_find', { text: 'Fixture row3999', maxResults: 1 });
  expect(last.length).toBeLessThan(8192);
  const reference = last.match(/button "Fixture row3999" \[ref=([^\]]+)\]/);
  expect(reference, last).toBeTruthy();
  expect((await call('browser_click', { target: reference![1] })).length).toBeLessThan(4096);
  expect(await call('browser_find', { text: 'Activated row3999', maxResults: 1 })).toContain('Activated row3999');
  await call('browser_close');
});
