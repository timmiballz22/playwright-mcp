/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from './fixtures';

test('original tracing independently retains an acknowledged owned click and rejects inactive stop', async ({ startClient, server }, testInfo) => {
  server.setContent('/', '<!doctype html><title>Independent trace</title><button onclick="document.querySelector(\'output\').textContent=\'1\'">Owned trace action</button><output>0</output>', 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--caps=devtools'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  };
  await call('browser_navigate', { url: server.PREFIX });
  expect((await client.callTool({ name: 'browser_stop_tracing', arguments: {} })).isError).toBe(true);
  await call('browser_start_tracing');
  await call('browser_click', { element: 'Owned trace action', target: 'button' });
  expect(await call('browser_snapshot')).toContain('"1"');
  const stopped = await call('browser_stop_tracing');
  const traceLink = stopped.match(/\[Trace[^\]]*\]\(([^)]+\.trace)\)/);
  const networkLink = stopped.match(/\[Network log[^\]]*\]\(([^)]+\.network)\)/);
  expect(traceLink, stopped).toBeTruthy(); expect(networkLink, stopped).toBeTruthy();
  const tracePath = path.resolve(testInfo.outputPath(), traceLink![1]);
  const bytes = await fs.readFile(tracePath);
  expect(bytes.length).toBeGreaterThan(0); expect(bytes.length).toBeLessThanOrEqual(8 * 1024 * 1024);
  const events = bytes.toString('utf8').trim().split('\n').map(line => JSON.parse(line));
  const click = events.find(event => event.type === 'before' && event.method === 'click');
  expect(click, 'Trace must retain the real click, not merely an empty trace file').toBeTruthy();
  const acknowledged = events.find(event => event.type === 'after' && event.callId === click.callId);
  expect(acknowledged).toBeTruthy(); expect(acknowledged.error).toBeUndefined();
  expect((await fs.stat(path.resolve(testInfo.outputPath(), networkLink![1]))).isFile()).toBe(true);
  expect((await client.callTool({ name: 'browser_stop_tracing', arguments: {} })).isError).toBe(true);
  console.log(JSON.stringify({ fixture: 'independent_original_trace', project: testInfo.project.name, bytes: bytes.length, clickAcknowledged: true }));
  await call('browser_close');
});

test('original PDF independently writes a Chromium document or explicitly rejects the unsupported engine', async ({ startClient, server, mcpBrowser }, testInfo) => {
  server.setContent('/', '<!doctype html><title>Independent PDF</title><h1>Owned printable document</h1>', 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--caps=pdf'] });
  expect((await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } })).isError).not.toBe(true);
  const filename = testInfo.outputPath('independent.pdf');
  const result = await client.callTool({ name: 'browser_pdf_save', arguments: { filename } });
  if (['chrome', 'chromium', 'msedge'].includes(mcpBrowser!)) {
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    const bytes = await fs.readFile(filename);
    expect(bytes.length).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.toString('latin1')).toMatch(/\/Type\s*\/Page\b/);
    expect(bytes.subarray(-1024).toString('latin1')).toContain('%%EOF');
    console.log(JSON.stringify({ fixture: 'independent_original_pdf', project: testInfo.project.name, supported: true, bytes: bytes.length }));
  } else {
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('PDF generation is only supported for Headless Chromium');
    await expect(fs.stat(filename)).rejects.toMatchObject({ code: 'ENOENT' });
    console.log(JSON.stringify({ fixture: 'independent_original_pdf', project: testInfo.project.name, supported: false, rejected: true }));
  }
  expect((await client.callTool({ name: 'browser_snapshot', arguments: {} })).isError).not.toBe(true);
  expect((await client.callTool({ name: 'browser_close', arguments: {} })).isError).not.toBe(true);
});
