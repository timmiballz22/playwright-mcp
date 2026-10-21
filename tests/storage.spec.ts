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
