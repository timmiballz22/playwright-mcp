/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from './fixtures';

test('original storage, screenshot, trace, video, tabs and Chromium PDF behavior', async ({ startClient, server, mcpBrowser }, testInfo) => {
  server.setContent('/', '<title>Parity Fixture</title><button>Save</button>', 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--caps=storage,devtools,pdf'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return result;
  };
  const text = (result: any) => result.content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('\n');
  await call('browser_navigate', { url: server.PREFIX });
  await call('browser_start_tracing');
  await call('browser_cookie_set', { name: 'fixture-cookie', value: 'fixture-value' });
  expect(text(await call('browser_cookie_get', { name: 'fixture-cookie' }))).toContain('fixture-value');
  await call('browser_localstorage_set', { key: 'fixture-key', value: 'fixture-storage' });
  expect(text(await call('browser_localstorage_get', { key: 'fixture-key' }))).toContain('fixture-storage');
  const screenshot = testInfo.outputPath('parity.png');
  await call('browser_take_screenshot', { filename: screenshot, scale: 'css' });
  expect((await fs.readFile(screenshot)).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const video = testInfo.outputPath('parity.webm');
  await call('browser_start_video', { filename: video, fps: 10 });
  await call('browser_click', { element: 'Save button', target: 'e2' });
  await call('browser_stop_video');
  expect((await fs.readFile(video)).subarray(0, 4).toString('hex')).toBe('1a45dfa3');
  await call('browser_tabs', { action: 'new', url: server.PREFIX });
  expect(text(await call('browser_tabs', { action: 'list' }))).toContain('Parity Fixture');
  await call('browser_tabs', { action: 'close' });
  const trace = text(await call('browser_stop_tracing'));
  const match = trace.match(/\[Trace[^\]]*\]\(([^)]+\.trace)\)/);
  expect(match, trace).toBeTruthy();
  expect((await fs.stat(path.resolve(testInfo.outputPath(), match![1]))).size).toBeGreaterThan(0);
  if (['chrome', 'chromium', 'msedge'].includes(mcpBrowser!)) {
    const pdf = testInfo.outputPath('parity.pdf');
    await call('browser_pdf_save', { filename: pdf });
    expect((await fs.readFile(pdf)).subarray(0, 5).toString()).toBe('%PDF-');
  }
});

test('original named tab contexts share only their own cookie and localStorage state', async ({ startClient, server }) => {
  server.setContent('/', '<!doctype html><title>Context isolation fixture</title><button>Ready</button>', 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--caps=storage'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return JSON.stringify(result.content);
  };
  await call('browser_navigate', { url: server.PREFIX });
  await call('browser_cookie_set', { name: 'main-only', value: 'main-fixture' });
  await call('browser_localstorage_set', { key: 'context-marker', value: 'main-fixture' });
  await call('browser_tabs', { action: 'new', url: server.PREFIX, isolatedContext: 'alpha' });
  expect(await call('browser_cookie_list')).not.toContain('main-only');
  expect(await call('browser_localstorage_list')).not.toContain('main-fixture');
  await call('browser_cookie_set', { name: 'named-only', value: 'alpha-fixture' });
  await call('browser_localstorage_set', { key: 'context-marker', value: 'alpha-fixture' });
  await call('browser_tabs', { action: 'new', url: server.PREFIX, isolatedContext: 'beta' });
  expect(await call('browser_cookie_list')).not.toContain('named-only');
  expect(await call('browser_localstorage_list')).not.toContain('alpha-fixture');
  await call('browser_tabs', { action: 'new', url: server.PREFIX, isolatedContext: 'alpha' });
  expect(await call('browser_cookie_get', { name: 'named-only' })).toContain('alpha-fixture');
  expect(await call('browser_localstorage_get', { key: 'context-marker' })).toContain('alpha-fixture');
  await call('browser_tabs', { action: 'select', index: 0 });
  expect(await call('browser_cookie_list')).not.toContain('named-only');
  expect(await call('browser_cookie_get', { name: 'main-only' })).toContain('main-fixture');
  expect(await call('browser_localstorage_get', { key: 'context-marker' })).toContain('main-fixture');
  await call('browser_close');
});
