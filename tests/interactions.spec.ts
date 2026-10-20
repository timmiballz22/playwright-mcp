/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from './fixtures';

test('original dialogs and workspace file upload preserve modal behavior', async ({ startClient, server }, testInfo) => {
  server.setContent('/', `<!doctype html><title>Modal fixture</title>
    <button id="prompt" onclick="document.querySelector('output').textContent=prompt('Fixture prompt')||'cancelled'">Prompt</button>
    <input id="upload" type="file" onchange="document.querySelector('output').textContent=this.files[0].name+':'+this.files[0].size">
    <output>Empty</output>`, 'text/html');
  const { client } = await startClient({ args: ['--isolated'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return result;
  };
  const text = (result: any) => result.content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('\n');
  await call('browser_navigate', { url: server.PREFIX });
  await call('browser_click', { target: '#prompt' });
  await call('browser_handle_dialog', { accept: true, promptText: 'fixture-answer' });
  expect(text(await call('browser_snapshot'))).toContain('fixture-answer');
  const noDialog = await client.callTool({ name: 'browser_handle_dialog', arguments: { accept: true } });
  expect(noDialog.isError).toBe(true);

  const upload = testInfo.outputPath('approved-fixture.txt');
  await fs.writeFile(upload, 'local fixture');
  await call('browser_click', { target: '#upload' });
  await call('browser_file_upload', { paths: [upload] });
  expect(text(await call('browser_snapshot'))).toContain('approved-fixture.txt:13');
  await call('browser_click', { target: '#upload' });
  const missing = await client.callTool({ name: 'browser_file_upload', arguments: { paths: [testInfo.outputPath('missing-fixture.txt')] } });
  expect(missing.isError).toBe(true);
  // Clear any still-open chooser after the rejected fixture path.
  await client.callTool({ name: 'browser_file_upload', arguments: {} });
  const link = testInfo.outputPath('escape-link');
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-upload-outside-'));
  try {
    const outsideFile = path.join(outside, 'outside-fixture.txt');
    await fs.writeFile(outsideFile, 'owned outside fixture');
    await call('browser_click', { target: '#upload' });
    const escaped = await client.callTool({ name: 'browser_file_upload', arguments: { paths: [outsideFile] } });
    expect(escaped.isError).toBe(true);
    await client.callTool({ name: 'browser_file_upload', arguments: {} });
    await fs.symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    await call('browser_click', { target: '#upload' });
    const linkedEscape = await client.callTool({ name: 'browser_file_upload', arguments: { paths: [path.join(link, 'outside-fixture.txt')] } });
    expect(linkedEscape.isError).toBe(true);
    await client.callTool({ name: 'browser_file_upload', arguments: {} });
  } finally {
    await fs.rm(link, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
  await call('browser_close');
});

test('original iframe snapshot targets stay scoped to the embedded document', async ({ startClient, server }) => {
  server.setContent('/', '<!doctype html><title>Frame fixture</title><button>Outer</button><iframe src="/frame"></iframe>', 'text/html');
  server.setContent('/plain', '<!doctype html><button onclick="this.textContent=\'Unexpected outer effect\'">Outer</button>', 'text/html');
  server.setContent('/frame', '<!doctype html><button onclick="this.textContent=\'Saved in frame\'">Frame save</button>', 'text/html');
  const { client } = await startClient({ args: ['--isolated'] });
  const navigate = await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });
  expect(navigate.isError).not.toBe(true);
  const snapshot = await client.callTool({ name: 'browser_snapshot', arguments: {} });
  const content = (snapshot as any).content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('\n');
  const frameTarget = content.match(/button "Frame save" \[ref=([^\]]+)\]/);
  expect(frameTarget, content).toBeTruthy();
  const click = await client.callTool({ name: 'browser_click', arguments: { target: frameTarget![1] } });
  expect(click.isError).not.toBe(true);
  const after = await client.callTool({ name: 'browser_snapshot', arguments: {} });
  expect(JSON.stringify(after)).toContain('Saved in frame');
  expect(JSON.stringify(after)).toContain('Outer');
  const replaced = await client.callTool({ name: 'browser_navigate', arguments: { url: new URL('plain', server.PREFIX).href } });
  expect(replaced.isError, JSON.stringify(replaced)).not.toBe(true);
  const stale = await client.callTool({ name: 'browser_click', arguments: { target: frameTarget![1] } });
  expect(stale.isError).toBe(true);
  const unchanged = await client.callTool({ name: 'browser_snapshot', arguments: {} });
  expect(JSON.stringify(unchanged)).toContain('Outer');
  expect(JSON.stringify(unchanged)).not.toContain('Unexpected outer effect');
  const closed = await client.callTool({ name: 'browser_close', arguments: {} });
  expect(closed.isError).not.toBe(true);
});
