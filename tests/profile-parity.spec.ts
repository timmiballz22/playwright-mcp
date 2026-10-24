/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import fs from 'node:fs/promises';
import { test, expect } from './fixtures';

test('original opt-in profile locks, restore, reset and independent profile isolation', async ({ startClient, server }, testInfo) => {
  test.setTimeout(90000);
  server.setContent('/', '<!doctype html><title>Profile fixture</title><button>Ready</button>', 'text/html');
  const profile = testInfo.outputPath('private-profile');
  await fs.mkdir(profile, { mode: 0o700 });
  if (process.platform !== 'win32') expect((await fs.stat(profile)).mode & 0o777).toBe(0o700);
  const open = (directory: string) => startClient({ args: ['--caps=storage'], config: { browser: { userDataDir: directory } } });
  const call = async (client: any, name: string, args: Record<string, unknown> = {}) => test.step(name, async () => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true); return result;
  }, { timeout: name === 'browser_navigate' ? 30000 : 10000 });
  const first = (await open(profile)).client;
  await call(first, 'browser_navigate', { url: server.PREFIX });
  await call(first, 'browser_cookie_set', { name: 'fake-profile-cookie', value: 'fake-profile-cookie-value', expires: Math.floor(Date.now() / 1000) + 3600 });
  await call(first, 'browser_localstorage_set', { key: 'fake-profile-key', value: 'fake-profile-local-value' });
  await call(first, 'browser_sessionstorage_set', { key: 'fake-profile-session', value: 'fake-profile-session-value' });
  const contending = (await open(profile)).client;
  const locked = await contending.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });
  expect(locked.isError).toBe(true);
  expect(JSON.stringify(locked)).toMatch(/already in use|already running|locked|in use by another/i);
  expect(JSON.stringify(await call(first, 'browser_sessionstorage_get', { key: 'fake-profile-session' }))).toContain('fake-profile-session-value');
  await call(first, 'browser_close');
  const restored = (await open(profile)).client;
  await call(restored, 'browser_navigate', { url: server.PREFIX });
  expect(JSON.stringify(await call(restored, 'browser_cookie_get', { name: 'fake-profile-cookie' }))).toContain('fake-profile-cookie-value');
  expect(JSON.stringify(await call(restored, 'browser_localstorage_get', { key: 'fake-profile-key' }))).toContain('fake-profile-local-value');
  expect(JSON.stringify(await call(restored, 'browser_sessionstorage_get', { key: 'fake-profile-session' }))).not.toContain('fake-profile-session-value');
  await call(restored, 'browser_close');
  const otherProfile = testInfo.outputPath('other-private-profile');
  await fs.mkdir(otherProfile, { mode: 0o700 });
  const isolated = (await open(otherProfile)).client;
  await call(isolated, 'browser_navigate', { url: server.PREFIX });
  expect(JSON.stringify(await call(isolated, 'browser_cookie_get', { name: 'fake-profile-cookie' }))).not.toContain('fake-profile-cookie-value');
  expect(JSON.stringify(await call(isolated, 'browser_localstorage_get', { key: 'fake-profile-key' }))).not.toContain('fake-profile-local-value');
  await call(isolated, 'browser_cookie_set', { name: 'fake-other-cookie', value: 'fake-other-cookie-value', expires: Math.floor(Date.now() / 1000) + 3600 });
  await call(isolated, 'browser_localstorage_set', { key: 'fake-other-key', value: 'fake-other-local-value' });
  await call(isolated, 'browser_close');

  // Reuse upstream clear tools. Resetting this profile must persist after close
  // and must not erase the independently persisted sibling profile's state.
  const reset = (await open(profile)).client;
  await call(reset, 'browser_navigate', { url: server.PREFIX });
  expect(JSON.stringify(await call(reset, 'browser_cookie_get', { name: 'fake-profile-cookie' }))).toContain('fake-profile-cookie-value');
  expect(JSON.stringify(await call(reset, 'browser_localstorage_get', { key: 'fake-profile-key' }))).toContain('fake-profile-local-value');
  await call(reset, 'browser_sessionstorage_set', { key: 'fake-profile-session', value: 'fake-profile-session-value' });
  await call(reset, 'browser_cookie_clear');
  await call(reset, 'browser_localstorage_clear');
  await call(reset, 'browser_sessionstorage_clear');
  expect(JSON.stringify(await call(reset, 'browser_cookie_get', { name: 'fake-profile-cookie' }))).not.toContain('fake-profile-cookie-value');
  expect(JSON.stringify(await call(reset, 'browser_localstorage_get', { key: 'fake-profile-key' }))).not.toContain('fake-profile-local-value');
  expect(JSON.stringify(await call(reset, 'browser_sessionstorage_get', { key: 'fake-profile-session' }))).not.toContain('fake-profile-session-value');
  await call(reset, 'browser_close');
  const resetRestored = (await open(profile)).client;
  await call(resetRestored, 'browser_navigate', { url: server.PREFIX });
  expect(JSON.stringify(await call(resetRestored, 'browser_cookie_get', { name: 'fake-profile-cookie' }))).not.toContain('fake-profile-cookie-value');
  expect(JSON.stringify(await call(resetRestored, 'browser_localstorage_get', { key: 'fake-profile-key' }))).not.toContain('fake-profile-local-value');
  await call(resetRestored, 'browser_close');
  const otherRestored = (await open(otherProfile)).client;
  await call(otherRestored, 'browser_navigate', { url: server.PREFIX });
  expect(JSON.stringify(await call(otherRestored, 'browser_cookie_get', { name: 'fake-other-cookie' }))).toContain('fake-other-cookie-value');
  expect(JSON.stringify(await call(otherRestored, 'browser_localstorage_get', { key: 'fake-other-key' }))).toContain('fake-other-local-value');
  await call(otherRestored, 'browser_close');
});
