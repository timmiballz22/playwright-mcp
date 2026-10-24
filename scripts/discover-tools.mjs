import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
await mkdir('docs/evidence', { recursive: true });
for (const browser of ['chromium', 'firefox', 'webkit']) {
  for (const caps of ['', 'config,network,storage,devtools,vision,pdf,testing']) {
    const client = new Client({ name: 'contract-discovery', version: '1.0.0' });
    try {
      const transport = new StdioClientTransport({ command: process.execPath, args: [path.resolve('cli.js'), '--browser', browser, '--isolated', '--headless', ...(caps ? ['--caps', caps] : [])], stderr: 'pipe' });
      transport.stderr.resume();
      await client.connect(transport);
      const result = await client.listTools();
      await writeFile(`docs/evidence/discovery-${browser}-${caps ? 'extended' : 'default'}.json`, JSON.stringify({ browser, caps, ...result }, null, 2) + '\n');
      console.log(JSON.stringify({ browser, caps, count: result.tools.length }));
    } finally { await client.close(); }
  }
}
