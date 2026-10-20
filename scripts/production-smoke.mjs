// Run from the source checkout; target an independently installed tarball.
import assert from 'node:assert/strict';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const target = path.resolve(process.argv[2]);
for (const entry of ['cli.js', 'local-batch/mcp.mjs']) {
  const client = new Client({ name: 'production-smoke', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(target, entry)], cwd: target, stderr: 'pipe' });
  try {
    await client.connect(transport);
    await client.ping();
    const { tools } = await client.listTools();
    assert.ok(tools.some(t => t.name === (entry === 'cli.js' ? 'browser_navigate' : 'browser_run_batch')));
    console.log(JSON.stringify({ entry, handshake: true, toolCount: tools.length }));
  } finally { await client.close(); }
}
