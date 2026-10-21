/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import { test, expect } from './fixtures';

test('original popup can be listed, selected, interacted with and closed without losing its opener', async ({ startClient, server }) => {
  server.setContent('/', '<!doctype html><title>Popup opener</title><button onclick="window.open(\'/popup\')">Open popup</button>', 'text/html');
  server.setContent('/popup', '<!doctype html><title>Owned popup</title><button onclick="this.textContent=\'Popup saved\'">Save popup</button>', 'text/html');
  const { client } = await startClient({ args: ['--isolated'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return JSON.stringify(result.content);
  };
  await call('browser_navigate', { url: server.PREFIX });
  await call('browser_click', { target: 'button' });
  const tabs = await call('browser_tabs', { action: 'list' });
  expect(tabs).toContain('Popup opener'); expect(tabs).toContain('Owned popup');
  await call('browser_tabs', { action: 'select', index: 1 });
  await call('browser_click', { target: 'button' });
  expect(await call('browser_snapshot')).toContain('Popup saved');
  await call('browser_tabs', { action: 'close', index: 1 });
  expect(await call('browser_snapshot')).toContain('Open popup');
  const remaining = await call('browser_tabs', { action: 'list' });
  expect(remaining).toContain('Popup opener'); expect(remaining).not.toContain('Owned popup');
  await call('browser_close');
});
