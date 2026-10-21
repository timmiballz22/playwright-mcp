// Fresh simultaneous SDK startup control after an actual Codex failure.
// No browser action, global config change, client restart or warmed Codex store.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { ownedDescendants } from '../local-batch/fixtures/process-audit.mjs';
const entry = fileURLToPath(new URL('../local-batch/jobs-mcp.mjs', import.meta.url));
const expected = ['start_workflow', 'get_workflow_status', 'get_workflow_result', 'cancel_workflow', 'list_workflows', 'cleanup_workflows'].sort();
for (let iteration = 1; iteration <= 3; iteration++) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sdk-jobs-startup-'));
  const clients = []; const transports = []; const startupCodes = new Set();
  let observed = []; let verified = false; const started = performance.now();
  try {
    const outcomes = await Promise.allSettled([0, 1].map(async index => {
      const client = new Client({ name: 'simultaneous-startup-control', version: '1.0.0' }); clients.push(client);
      const transport = new StdioClientTransport({ command: process.execPath, args: [entry], cwd: directory, stderr: 'pipe', env: {
        ...process.env, PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_DATA_DIR: path.join(directory, 'state'),
        PLAYWRIGHT_JOBS_PROJECT_DIR: directory, PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: '', PLAYWRIGHT_JOBS_ALLOW_MUTATIONS: '0', PLAYWRIGHT_JOBS_ALLOW_SENSITIVE_ARTIFACTS: '0',
      } });
      transports.push(transport); let tail = '';
      transport.stderr.on('data', chunk => {
        tail = (tail + chunk.toString()).slice(-4096);
        for (const match of tail.matchAll(/Local jobs startup failed \(([a-z_]{1,40})\)/g)) startupCodes.add(match[1]);
      });
      await client.connect(transport, { timeout: 20000 });
      const tools = (await client.listTools({}, { timeout: 5000 })).tools.map(tool => tool.name).sort();
      assert.deepEqual(tools, expected);
      const empty = await client.callTool({ name: 'list_workflows', arguments: { limit: 1 } }, undefined, { timeout: 5000 });
      assert.notEqual(empty.isError, true); assert.deepEqual(JSON.parse(empty.content[0].text).jobs, []);
      return { index, tools: tools.length };
    }));
    const receipt = { os: process.platform, iteration, clients: 2, connected: outcomes.filter(item => item.status === 'fulfilled').length,
      durationMs: Math.round(performance.now() - started), startupCodes: [...startupCodes].sort(), browserActions: 0 };
    console.log(JSON.stringify(receipt));
    assert.equal(receipt.connected, 2, 'Fresh simultaneous SDK startup failed'); verified = true;
  } finally {
    const roots = transports.map(transport => transport.pid).filter(Number.isSafeInteger);
    try { observed = await ownedDescendants(roots, { rememberLiveRoots: true }); }
    finally { await Promise.allSettled(clients.map(client => client.close())); }
    const end = performance.now() + 10000;
    while ((await ownedDescendants([...roots, ...observed])).length && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 100));
    assert.deepEqual(await ownedDescendants([...roots, ...observed]), []);
    console.log(JSON.stringify({ iteration, activeOwnedProcesses: 0 }));
    if (verified) await rm(directory, { recursive: true, force: true });
  }
}
