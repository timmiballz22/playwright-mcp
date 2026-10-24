/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import { test, expect } from './fixtures';

test('original config, locator and testing tools verify real controls and reject mismatches', async ({ startClient, server }) => {
  server.setContent('/', `<!doctype html><title>Owned testing tools fixture</title>
    <button>Save fixture</button><label>Fixture name<input id="name" value="fixture-name"></label>
    <input id="agree" type="checkbox" checked aria-label="Fixture agreement">
    <input id="radio" type="radio" checked aria-label="Fixture radio">
    <select id="choice" aria-label="Fixture choice"><option value="alpha" selected>Alpha</option><option value="beta">Beta</option></select>
    <input id="slider" type="range" min="0" max="10" value="2" aria-label="Fixture slider">
    <ul id="rows"><li>Alpha row</li><li>Beta row</li></ul><p>Owned visible message</p>`, 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--caps=config,testing'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  };
  expect(await call('browser_get_config')).toMatch(/"isolated"\s*:\s*true/);
  await call('browser_navigate', { url: server.PREFIX });
  expect(await call('browser_generate_locator', { target: '#name', element: 'Fixture name' })).toContain("locator('#name')");
  await call('browser_verify_element_visible', { role: 'button', accessibleName: 'Save fixture' });
  await call('browser_verify_text_visible', { text: 'Owned visible message' });
  await call('browser_verify_list_visible', { target: '#rows', element: 'Fixture rows', items: ['Alpha row', 'Beta row'] });
  for (const [type, target, value] of [
    ['textbox', '#name', 'fixture-name'], ['checkbox', '#agree', 'true'], ['radio', '#radio', 'true'],
    ['combobox', '#choice', 'alpha'], ['slider', '#slider', '2'],
  ]) await call('browser_verify_value', { type, target, value, element: 'Owned fixture control' });
  for (const [name, args] of [
    ['browser_verify_element_visible', { role: 'button', accessibleName: 'Missing fixture button' }],
    ['browser_verify_text_visible', { text: 'Missing fixture paragraph' }],
    ['browser_verify_list_visible', { target: '#rows', element: 'Fixture rows', items: ['Missing fixture row'] }],
    ['browser_verify_value', { type: 'textbox', target: '#name', element: 'Fixture name', value: 'wrong-value' }],
  ] as const) {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).toBe(true);
  }
  await call('browser_close');
});
