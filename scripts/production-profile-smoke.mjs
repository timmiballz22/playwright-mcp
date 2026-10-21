// Installed original endpoint: real persistent profile plus cross-client guard.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, lstat, rm } from 'node:fs/promises';
import { ownedDescendants } from '../local-batch/fixtures/process-audit.mjs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const target = path.resolve(process.argv[2]);
const root = await mkdtemp(path.join(os.tmpdir(), 'installed-profile-'));
const profile = path.join(root, 'profile'); await mkdir(profile, { mode: 0o700 });
const fixture = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<title>Owned profile fixture</title><button>Ready</button>'); });
fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
const origin = `http://127.0.0.1:${fixture.address().port}`;
const clients = []; const roots = []; let observed = []; let verified = false;
const open = async () => {
  const client = new Client({ name: 'installed-profile', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(target, 'cli.js'), '--browser=chromium', '--headless', '--caps=storage', '--user-data-dir', profile], stderr: 'pipe', cwd: root });
  clients.push(client); await client.connect(transport); roots.push(transport.pid); return { client, pid: transport.pid };
};
const call = async (client, name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  assert.notEqual(result.isError, true, 'Installed profile tool failed'); return JSON.stringify(result.content);
};
try {
  const first = await open(); await call(first.client, 'browser_navigate', { url: origin });
  const ownerPath = path.join(profile, '.playwright-mcp-owner', 'owner.json');
  const owner = JSON.parse(await readFile(ownerPath, 'utf8')); assert.equal(owner.pid, first.pid);
  if (process.platform !== 'win32') assert.equal((await lstat(ownerPath)).mode & 0o777, 0o600);
  await call(first.client, 'browser_cookie_set', { name: 'fake-persistent', value: 'fake-profile-value', expires: Math.floor(Date.now() / 1000) + 3600 });
  observed = await ownedDescendants(roots, { rememberLiveRoots: true });
  const contender = await open();
  const blocked = await contender.client.callTool({ name: 'browser_navigate', arguments: { url: origin } });
  assert.equal(blocked.isError, true); assert.match(JSON.stringify(blocked.content), /already in use/);
  await call(first.client, 'browser_close');
  await assert.rejects(lstat(path.dirname(ownerPath)), { code: 'ENOENT' });
  const restored = await open(); await call(restored.client, 'browser_navigate', { url: origin });
  assert.ok((await call(restored.client, 'browser_cookie_get', { name: 'fake-persistent' })).includes('fake-profile-value'));
  observed.push(...await ownedDescendants(roots, { rememberLiveRoots: true }));
  await call(restored.client, 'browser_close');
  await assert.rejects(lstat(path.dirname(ownerPath)), { code: 'ENOENT' }); verified = true;
} finally {
  let clean = false;
  try {
    observed.push(...await ownedDescendants(roots, { rememberLiveRoots: true }));
    await Promise.allSettled(clients.map(client => client.close()));
    const end = performance.now() + 10000;
    while ((await ownedDescendants([...roots, ...observed])).length && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepEqual(await ownedDescendants([...roots, ...observed]), []); clean = true;
  } finally {
    await Promise.allSettled(clients.map(client => client.close()));
    fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
    if (clean && verified) await rm(root, { recursive: true, force: true });
  }
}
console.log(JSON.stringify({ component: 'delegated_profile_guard', production: true, realBrowser: 'chromium', contentionDenied: true, persistentCookieRestored: true, leaseReleasedAfterClose: true, activeOwnedProcesses: 0 }));
