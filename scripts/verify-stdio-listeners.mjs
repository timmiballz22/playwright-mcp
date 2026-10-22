// Optional Linux operator probe. Read-only socket inventory of live owned stdio
// endpoints before browser work, never a global port scan or a process killer.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, readFile, readdir, readlink, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { ownedDescendants } from '../local-batch/fixtures/process-audit.mjs';
if (process.platform !== 'linux') throw new Error('listener_probe_linux_only');
const target = path.resolve(process.argv[2] ?? fileURLToPath(new URL('../', import.meta.url)));
const root = await mkdtemp(path.join(os.tmpdir(), 'stdio-listeners-'));
const clients = []; const roots = []; let verified = false; let summary;
try {
  const discoveries = [];
  for (const [entry, args, count] of [
    ['cli.js', ['--browser=chromium', '--headless', '--isolated'], 25],
    ['local-batch/mcp.mjs', [], 1], ['local-batch/jobs-mcp.mjs', [], 6],
  ]) {
    const client = new Client({ name: 'owned-listener-probe', version: '1.0.0' }); clients.push(client);
    const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(target, entry), ...args], stderr: 'pipe', cwd: root,
      env: { ...process.env, PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_DATA_DIR: path.join(root, 'state'), PLAYWRIGHT_JOBS_PROJECT_DIR: root },
    });
    transport.stderr.resume();
    await client.connect(transport); roots.push(transport.pid);
    assert.equal((await client.listTools()).tools.length, count); discoveries.push({ entry, tools: count });
  }
  const owned = await ownedDescendants(roots); assert.ok(owned.length >= roots.length);
  const sockets = new Set();
  for (const pid of owned) {
    for (const descriptor of await readdir(`/proc/${pid}/fd`)) {
      let link;
      try { link = await readlink(`/proc/${pid}/fd/${descriptor}`); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      const match = /^socket:\[(\d+)\]$/.exec(link); if (match) sockets.add(match[1]);
    }
  }
  let listeners = 0;
  for (const table of ['tcp', 'tcp6']) {
    for (const line of (await readFile('/proc/net/' + table, 'utf8')).trim().split('\n').slice(1)) {
      const fields = line.trim().split(/\s+/);
      if (fields[3] === '0A' && sockets.has(fields[9])) listeners++;
    }
  }
  assert.equal(listeners, 0, 'Idle owned stdio endpoints must not expose TCP listeners');
  summary = { os: 'linux', phase: 'initialized_before_browser_work', discoveries, ownedProcesses: owned.length, ownedTcpListeners: listeners, modelTurns: 0 };
  verified = true;
} finally {
  await Promise.allSettled(clients.map(client => client.close()));
  const end = performance.now() + 8000;
  while ((await ownedDescendants(roots)).length && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 50));
  const remaining = await ownedDescendants(roots);
  assert.deepEqual(remaining, [], 'Owned stdio processes must exit after shutdown');
  if (verified) await rm(root, { recursive: true, force: true });
}
console.log(JSON.stringify({ ...summary, activeOwnedProcessesAfterShutdown: 0 }));
