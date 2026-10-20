#!/usr/bin/env node
// Separate, optional MCP sidecar. Microsoft's upstream Playwright MCP remains unchanged.
// Install full clone dependencies first: npm ci.
import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { runWorkflow } from './runner.mjs';
import { saveReport } from './report.mjs';

const server = new Server({ name: 'local-playwright-batch', version: '0.1.0' }, {
  capabilities: { tools: {} },
});
// Allowlist belongs to the LOCAL operator, not the agent's tool arguments.
const allowedOrigins = (process.env.PLAYWRIGHT_BATCH_ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const artifactsDir = path.resolve(process.env.PLAYWRIGHT_BATCH_ARTIFACTS_DIR || '.local-batch-output');
let busy = false;
let activeAbort;
const shutdown = () => activeAbort?.abort();
server.onclose = shutdown;
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'browser_run_batch',
    description: 'Run bounded, ordered local Playwright browser actions; only exact operator-configured origins. Returns concise summary and local report path. No arbitrary JavaScript or shell execution.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['steps'],
      properties: {
        browser: { type: 'string', enum: ['chromium', 'firefox', 'webkit'] },
        iterations: { type: 'integer', minimum: 1, maximum: 100 },
        timeoutMs: { type: 'integer', minimum: 100, maximum: 180000 },
        actionTimeoutMs: { type: 'integer', minimum: 100, maximum: 30000 },
        steps: {
          type: 'array', minItems: 1, maxItems: 1000,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['type'],
            properties: {
              type: { type: 'string', enum: ['goto','click','fill','press','check',
                'uncheck','hover','waitFor','assertText','assertURL','scroll','screenshot'] },
              url: { type: 'string' }, selector: { type: 'string' },
              value: { type: 'string' }, key: { type: 'string' },
              contains: { type: 'string' },
              deltaX: { type: 'integer' }, deltaY: { type: 'integer' },
            },
          },
        },
      },
    },
  }],
}));

server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  if (request.params.name !== 'browser_run_batch')
    return { isError: true, content: [{ type: 'text', text: 'Unknown tool' }] };
  if (busy)
    return { isError: true, content: [{ type: 'text', text: 'A batch is already running' }] };
  busy = true;
  activeAbort = new AbortController();
  const abort = () => activeAbort?.abort();
  extra.signal.addEventListener('abort', abort, { once: true });
  if (extra.signal.aborted) abort();
  try {
    const result = await runWorkflow(request.params.arguments, {
      allowedOrigins, artifactsDir, signal: activeAbort.signal,
    });
    const summary = await saveReport(result, artifactsDir);
    return { isError: !result.ok, content: [{ type: 'text', text: JSON.stringify(summary) }] };
  } catch (error) {
    // Do not expose secrets from malformed URLs, browser errors or arbitrary page text.
    return { isError: true, content: [{ type: 'text', text: 'Batch rejected or failed (' +
      (error?.name || 'Error') + '). Check trusted local diagnostics.' }] };
  } finally {
    extra.signal.removeEventListener('abort', abort);
    activeAbort = undefined;
    busy = false;
  }
});

await server.connect(new StdioServerTransport());
