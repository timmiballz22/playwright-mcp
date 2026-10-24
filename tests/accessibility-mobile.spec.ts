/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import fs from 'node:fs/promises';
import { test, expect } from './fixtures';

test('original ARIA snapshot and keyboard-only activation preserve focus order', async ({ startClient, server }) => {
  // Explicit tabindex ARIA widgets avoid macOS' native-button Keyboard Navigation
  // preference. No host settings, pointer actions or programmatic focus calls.
  server.setContent('/', `<!doctype html><title>Keyboard fixture</title>
    <div role="button" tabindex="0" aria-label="Save settings" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.querySelector('output').textContent='Saved by keyboard'}">Save</div>
    <div role="button" tabindex="0" aria-label="Cancel settings" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.querySelector('output').textContent='Cancelled by keyboard'}">Cancel</div>
    <output aria-live="polite">Waiting</output>`, 'text/html');
  const { client } = await startClient({ args: ['--isolated'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true); return result;
  };
  await call('browser_navigate', { url: server.PREFIX });
  expect(JSON.stringify(await call('browser_snapshot'))).toContain('Save settings');
  await call('browser_press_key', { key: 'Tab' });
  await call('browser_press_key', { key: 'Enter' });
  expect(JSON.stringify(await call('browser_snapshot'))).toContain('Saved by keyboard');
  await call('browser_press_key', { key: 'Tab' });
  await call('browser_press_key', { key: 'Space' });
  expect(JSON.stringify(await call('browser_snapshot'))).toContain('Cancelled by keyboard');
  await call('browser_close');
});

test('original responsive viewport, CSS screenshot and actual touch preserve fixture behavior', async ({ startClient, server, mcpBrowser }, testInfo) => {
  server.setContent('/', `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Touch fixture</title><style>#mobile{display:none}@media(max-width:600px){#mobile{display:block}}</style>
    <div id="mobile" role="status">Mobile layout</div>
    <button aria-label="Touch action" ontouchstart="document.querySelector('output').textContent='Touched once'">Touch</button><output>Untouched</output>`, 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--caps=unsafe'], config: {
    browser: { contextOptions: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: mcpBrowser !== 'firefox', hasTouch: true } },
  } });
  const navigation = await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });
  // Firefox deliberately uses desktop viewport plus hasTouch. This test does
  // not claim full Firefox mobile-device emulation from an accepted option.
  expect(navigation.isError, JSON.stringify(navigation)).not.toBe(true);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true); return result;
  };
  expect(JSON.stringify(await call('browser_snapshot'))).toContain('Mobile layout');
  // Explicit unsafe capability, trusted static fixture code: the original
  // endpoint has no dedicated touchscreen tool. New batch/jobs accept no code.
  await call('browser_run_code_unsafe', { code: "async page => { await page.getByRole('button', { name: 'Touch action', exact: true }).tap(); }" });
  expect(JSON.stringify(await call('browser_snapshot'))).toContain('Touched once');
  const filename = testInfo.outputPath('mobile-css.png');
  await call('browser_take_screenshot', { filename, scale: 'css', fullPage: false });
  const png = await fs.readFile(filename);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(390); expect(png.readUInt32BE(20)).toBe(844);
  await call('browser_close');
});

test('original media emulation switches dark mode and reduced motion and resets both', async ({ startClient, server }) => {
  server.setContent('/', `<!doctype html><title>Media fixture</title><style>
    #dark,#motion{display:none}@media(prefers-color-scheme:dark){#dark{display:block}}
    @media(prefers-reduced-motion:reduce){#motion{display:block}}
    </style><p id="dark">Dark media active</p><p id="motion">Reduced motion active</p><button>Ready</button>`, 'text/html');
  const { client } = await startClient({ args: ['--isolated'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true); return result;
  };
  await call('browser_navigate', { url: server.PREFIX });
  await call('browser_emulate_media', { colorScheme: 'light', reducedMotion: 'no-preference' });
  let snapshot = JSON.stringify(await call('browser_snapshot'));
  expect(snapshot).not.toContain('Dark media active'); expect(snapshot).not.toContain('Reduced motion active');
  await call('browser_emulate_media', { colorScheme: 'dark', reducedMotion: 'reduce' });
  snapshot = JSON.stringify(await call('browser_snapshot'));
  expect(snapshot).toContain('Dark media active'); expect(snapshot).toContain('Reduced motion active');
  await call('browser_emulate_media', { colorScheme: 'light', reducedMotion: 'no-preference' });
  snapshot = JSON.stringify(await call('browser_snapshot'));
  expect(snapshot).not.toContain('Dark media active'); expect(snapshot).not.toContain('Reduced motion active');
  await call('browser_close');
});
