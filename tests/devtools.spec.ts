/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import fs from 'node:fs/promises';
import { PNG } from 'pngjs';
import { test, expect } from './fixtures';

test('original highlight paints a controlled region and both hide methods clear it', async ({ startClient, server }, testInfo) => {
  server.setContent('/', '<!doctype html><style>body{margin:0;background:white}button{position:absolute;left:20px;top:20px;width:120px;height:40px}</style><button>Owned highlight</button>', 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--caps=devtools'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
  };
  const capture = async (name: string) => {
    const filename = testInfo.outputPath(name + '.png');
    await call('browser_take_screenshot', { filename, scale: 'css' });
    const bytes = await fs.readFile(filename); expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const image = PNG.sync.read(bytes); expect(image.width).toBeGreaterThan(148); expect(image.height).toBeGreaterThan(20);
    // Outside the button text: PNG compression/font rasterization are not the
    // feature contract. Require the controlled red outline and its removal.
    const pixels: number[] = []; let redPixels = 0;
    for (let y = 14; y < 18; y++) for (let x = 16; x < 144; x++) {
      const offset = (y * image.width + x) * 4;
      const [r, g, b, a] = image.data.subarray(offset, offset + 4); pixels.push(r, g, b, a);
      if (r >= 230 && g <= 100 && b <= 100 && a >= 240) redPixels++;
    }
    return { pixels: Buffer.from(pixels), redPixels };
  };
  const observe = async (phase: string, ready: (sample: Awaited<ReturnType<typeof capture>>) => boolean) => {
    const end = performance.now() + 5000;
    for (let attempt = 1; ; attempt++) {
      // Observe the actual screenshot rather than inserting an extra MCP
      // evaluate/animation-frame round trip before every valid frame. Native
      // Windows Firefox spent 6.2s in that prerequisite alone; the same 5s
      // observation bound and pixel conditions still govern this loop.
      // Failed screenshot calls throw immediately; only valid frames are observed.
      const sample = await capture(`${phase}-${attempt}`);
      if (ready(sample) && performance.now() <= end) { console.log(JSON.stringify({ fixture: 'highlight_region', phase, observations: attempt, redPixels: sample.redPixels })); return sample; }
      if (performance.now() >= end || attempt >= 20) throw new Error(`Owned highlight ${phase} did not settle: redPixels=${sample.redPixels}`);
    }
  };
  await call('browser_navigate', { url: server.PREFIX });
  const plain = await observe('plain', sample => sample.redPixels === 0);
  const style = 'outline: 8px solid red; background: rgba(255,0,0,0.7)';
  await call('browser_highlight', { target: 'button', element: 'Owned highlight', style });
  await observe('highlighted', sample => sample.redPixels > 200);
  await call('browser_hide_highlight', { target: 'button', element: 'Owned highlight' });
  await observe('restored', sample => sample.redPixels === 0 && sample.pixels.equals(plain.pixels));
  await call('browser_highlight', { target: 'button', element: 'Owned highlight', style });
  await observe('highlighted-again', sample => sample.redPixels > 200);
  await call('browser_hide_highlight');
  await observe('restored-all', sample => sample.redPixels === 0 && sample.pixels.equals(plain.pixels));
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

test('original resume rejects malformed source locations and leaves the session usable', async ({ startClient, server }) => {
  server.setContent('/', '<!doctype html><h1>Owned resume fixture</h1>', 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--caps=devtools'] });
  expect((await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } })).isError).not.toBe(true);
  const rejected = await client.callTool({ name: 'browser_resume', arguments: { location: 'owned.spec.ts:invalid' } });
  expect(rejected.isError).toBe(true);
  expect(rejected.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'text', text: expect.stringContaining('Invalid location') })]));
  const snapshot = await client.callTool({ name: 'browser_snapshot', arguments: {} });
  expect(snapshot.isError).not.toBe(true);
  expect(JSON.stringify(snapshot.content)).toContain('Owned resume fixture');
  expect((await client.callTool({ name: 'browser_close', arguments: {} })).isError).not.toBe(true);
});
