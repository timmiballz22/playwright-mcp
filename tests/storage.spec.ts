/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import { test, expect } from './fixtures';

for (const store of ['cookie', 'localstorage', 'sessionstorage']) {
  test(`original ${store} get/set/list/delete/clear preserve sibling values`, async ({ startClient, server }) => {
    server.setContent('/', '<!doctype html><title>Owned storage fixture</title>', 'text/html');
    const { client } = await startClient({ args: ['--isolated', '--caps=storage'] });
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, JSON.stringify(result)).not.toBe(true);
      return result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
    };
    const field = store === 'cookie' ? 'name' : 'key';
    const tool = (operation: string) => `browser_${store}_${operation}`;
    await call('browser_navigate', { url: server.PREFIX });
    await call(tool('set'), { [field]: 'fixture-alpha', value: 'alpha-fixture-value' });
    await call(tool('set'), { [field]: 'fixture-beta', value: 'beta-fixture-value' });
    expect(await call(tool('get'), { [field]: 'fixture-alpha' })).toContain('alpha-fixture-value');
    const populated = await call(tool('list'));
    expect(populated).toContain('fixture-alpha'); expect(populated).toContain('fixture-beta');
    await call(tool('delete'), { [field]: 'fixture-alpha' });
    const remaining = await call(tool('list'));
    expect(remaining).not.toContain('fixture-alpha'); expect(remaining).toContain('fixture-beta');
    expect(await call(tool('get'), { [field]: 'fixture-beta' })).toContain('beta-fixture-value');
    await call(tool('clear'));
    const empty = await call(tool('list'));
    expect(empty).not.toContain('fixture-alpha'); expect(empty).not.toContain('fixture-beta');
    await call('browser_close');
  });
}

test('original storage state export/restore replaces existing cookie and localStorage values', async ({ startClient, server }, testInfo) => {
  const inheritedMask = process.platform === 'win32' ? undefined : process.umask(0o022);
  try {
    const fs = await import('node:fs/promises');
    server.setContent('/', '<!doctype html><title>Owned storage export fixture</title>', 'text/html');
    const invoke = async (client: any, name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, JSON.stringify(result)).not.toBe(true);
      return result.content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('\n');
    };
    const first = (await startClient({ args: ['--isolated', '--caps=storage'] })).client;
    await invoke(first, 'browser_navigate', { url: server.PREFIX });
    await invoke(first, 'browser_cookie_set', { name: 'export-cookie', value: 'fake-export-cookie' });
    await invoke(first, 'browser_localstorage_set', { key: 'export-key', value: 'fake-export-local' });
    await invoke(first, 'browser_sessionstorage_set', { key: 'not-exported', value: 'fake-session-only' });
    const filename = testInfo.outputPath('fake-storage-state.json');
    await invoke(first, 'browser_storage_state', { filename });
    const saved = JSON.parse(await fs.readFile(filename, 'utf8'));
    expect(saved.cookies.some((cookie: any) => cookie.name === 'export-cookie' && cookie.value === 'fake-export-cookie')).toBe(true);
    expect(saved.origins.some((origin: any) => origin.localStorage.some((item: any) => item.name === 'export-key' && item.value === 'fake-export-local'))).toBe(true);
    expect(JSON.stringify(saved)).not.toContain('fake-session-only');
    if (process.platform !== 'win32') expect((await fs.stat(filename)).mode & 0o777).toBe(0o600);
    await invoke(first, 'browser_close');
    const restored = (await startClient({ args: ['--isolated', '--caps=storage'] })).client;
    await invoke(restored, 'browser_navigate', { url: server.PREFIX });
    await invoke(restored, 'browser_cookie_set', { name: 'old-cookie', value: 'fake-old-cookie' });
    await invoke(restored, 'browser_localstorage_set', { key: 'old-key', value: 'fake-old-local' });
    await invoke(restored, 'browser_set_storage_state', { filename });
    await invoke(restored, 'browser_navigate', { url: server.PREFIX });
    expect(await invoke(restored, 'browser_cookie_get', { name: 'export-cookie' })).toContain('fake-export-cookie');
    expect(await invoke(restored, 'browser_localstorage_get', { key: 'export-key' })).toContain('fake-export-local');
    expect(await invoke(restored, 'browser_cookie_list')).not.toContain('old-cookie');
    expect(await invoke(restored, 'browser_localstorage_list')).not.toContain('old-key');
    expect(await invoke(restored, 'browser_sessionstorage_list')).not.toContain('not-exported');
    await invoke(restored, 'browser_close');
  } finally { if (inheritedMask !== undefined) process.umask(inheritedMask); }
});
