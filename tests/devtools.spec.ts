/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import fs from 'node:fs/promises';
import { test, expect } from './fixtures';

test('original highlight changes a real screenshot and hide restores the static page', async ({ startClient, server }, testInfo) => {
  server.setContent('/', '<!doctype html><style>body{margin:0;background:white}button{position:absolute;left:20px;top:20px;width:120px;height:40px}</style><button>Owned highlight</button>', 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--caps=devtools'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
  };
  const capture = async (name: string) => {
    const filename = testInfo.outputPath(name + '.png');
    await call('browser_take_screenshot', { filename, scale: 'css' });
    const bytes = await fs.readFile(filename); expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); return bytes;
  };
  await call('browser_navigate', { url: server.PREFIX });
  const plain = await capture('plain');
  await call('browser_highlight', { target: 'button', element: 'Owned highlight', style: 'outline: 8px solid red; background: rgba(255,0,0,0.7)' });
  expect((await capture('highlighted')).equals(plain)).toBe(false);
  await call('browser_hide_highlight', { target: 'button', element: 'Owned highlight' });
  expect((await capture('restored')).equals(plain)).toBe(true);
  await call('browser_highlight', { target: 'button', element: 'Owned highlight' });
  await call('browser_hide_highlight');
  expect((await capture('restored-all')).equals(plain)).toBe(true);
  await call('browser_close');
});

test('original action recording captures owned pointer input and rejects invalid lifecycle calls', async ({ startClient, server }) => {
  server.setContent('/', '<!doctype html><style>body{margin:0}button{position:absolute;left:20px;top:20px;width:100px;height:40px}</style><button onclick="document.querySelector(\'output\').textContent=\'clicked\'">Record me</button><output>ready</output>', 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--caps=devtools,vision'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  };
  await call('browser_navigate', { url: server.PREFIX });
  expect((await client.callTool({ name: 'browser_stop_recording', arguments: {} })).isError).toBe(true);
  await call('browser_start_recording');
  expect((await client.callTool({ name: 'browser_start_recording', arguments: {} })).isError).toBe(true);
  await call('browser_mouse_click_xy', { x: 70, y: 40 });
  const recorded = await call('browser_stop_recording');
  const code = recorded.match(/Recorded actions:\s*```[^\n]*\n([\s\S]*?)```/);
  expect(code, recorded).toBeTruthy(); expect(code![1]).toMatch(/\.click\(/);
  expect(await call('browser_snapshot')).toContain('clicked');
  expect((await client.callTool({ name: 'browser_stop_recording', arguments: {} })).isError).toBe(true);
  await call('browser_close');
});
