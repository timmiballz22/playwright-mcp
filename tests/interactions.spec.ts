/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from './fixtures';

test('original dialogs and workspace file upload preserve modal behavior', async ({ startClient, server }, testInfo) => {
  let uploadClickPosts = 0, uploadClickAttempts = 0;
  server.route('/owned-upload-click', (request, response) => {
    expect(request.method).toBe('POST'); uploadClickPosts++; response.writeHead(204); response.end();
  });
  const stall = process.env.PLAYWRIGHT_TEST_MODAL_UPLOAD_STALL === '1'
    ? 'const end=performance.now()+6000;while(performance.now()<end){}' : '';
  server.setContent('/', `<!doctype html><title>Modal fixture</title>
    <button id="prompt" onclick="document.querySelector('output').textContent=prompt('Fixture prompt')||'cancelled'">Prompt</button>
    <input id="upload" type="file" onclick="fetch('/owned-upload-click',{method:'POST'}).catch(()=>{});${stall}" onchange="document.querySelector('output').textContent=this.files[0].name+':'+this.files[0].size">
    <output>Empty</output>`, 'text/html');
  const { client } = await startClient({ args: ['--isolated'] });
  let operation = 0;
  const invoke = async (name: string, args: Record<string, unknown> = {}) => {
    const index = ++operation;
    return await test.step(`modal fixture ${index}: ${name}`, async () => {
      try { return await client.callTool({ name, arguments: args }); }
      catch (error) {
        // Static fixture stage only: no paths, input values, responses or stderr.
        console.error(JSON.stringify({ fixture: 'modal_upload', operation: index, tool: name, failed: true }));
        throw error;
      }
    }, { timeout: name === 'browser_navigate' ? 30000 : 10000 });
  };
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    if (name === 'browser_click' && args.target === '#upload') uploadClickAttempts++;
    const result = await invoke(name, args);
    if (result.isError && name === 'browser_click' && args.target === '#upload') {
      // Observe the owned event witness and one read-only snapshot; never replay
      // the click, accept a chooser, or replace the original failed result.
      let snapshotReturned = false, snapshotError = false, mentionsFileChooser = false, mentionsUploadTool = false;
      try {
        const snapshot = await client.callTool({ name: 'browser_snapshot', arguments: {} }, undefined,
          { signal: AbortSignal.timeout(1000), timeout: 1000 });
        snapshotReturned = true; snapshotError = !!snapshot.isError;
        const value = snapshot.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
        mentionsFileChooser = /file chooser/i.test(value); mentionsUploadTool = value.includes('browser_file_upload');
      } catch {}
      console.log(JSON.stringify({ fixture: 'owned_upload_click_failure', operation, uploadClickAttempts, uploadClickPosts,
        postCountIsLowerBound: true, snapshotReturned, snapshotError, mentionsFileChooser, mentionsUploadTool }));
    }
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return result;
  };
  const text = (result: any) => result.content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('\n');
  await call('browser_navigate', { url: server.PREFIX });
  await call('browser_click', { target: '#prompt' });
  await call('browser_handle_dialog', { accept: true, promptText: 'fixture-answer' });
  expect(text(await call('browser_snapshot'))).toContain('fixture-answer');
  const noDialog = await invoke('browser_handle_dialog', { accept: true });
  expect(noDialog.isError).toBe(true);

  const upload = testInfo.outputPath('approved-fixture.txt');
  await fs.writeFile(upload, 'local fixture');
  await call('browser_click', { target: '#upload' });
  await call('browser_file_upload', { paths: [upload] });
  expect(text(await call('browser_snapshot'))).toContain('approved-fixture.txt:13');
  await call('browser_click', { target: '#upload' });
  const missing = await invoke('browser_file_upload', { paths: [testInfo.outputPath('missing-fixture.txt')] });
  expect(missing.isError).toBe(true);
  // Clear any still-open chooser after the rejected fixture path.
  await invoke('browser_file_upload');
  const link = testInfo.outputPath('escape-link');
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-upload-outside-'));
  try {
    const outsideFile = path.join(outside, 'outside-fixture.txt');
    await fs.writeFile(outsideFile, 'owned outside fixture');
    await call('browser_click', { target: '#upload' });
    const escaped = await invoke('browser_file_upload', { paths: [outsideFile] });
    expect(escaped.isError).toBe(true);
    await invoke('browser_file_upload');
    await fs.symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    await call('browser_click', { target: '#upload' });
    const linkedEscape = await invoke('browser_file_upload', { paths: [path.join(link, 'outside-fixture.txt')] });
    expect(linkedEscape.isError).toBe(true);
    await invoke('browser_file_upload');
  } finally {
    await fs.rm(link, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
  expect(uploadClickAttempts).toBe(4);
  await expect.poll(() => uploadClickPosts).toBe(4);
  await call('browser_close');
});

test('original iframe snapshot targets stay scoped to the embedded document', async ({ startClient, server }) => {
  server.setContent('/', '<!doctype html><title>Frame fixture</title><button>Outer</button><iframe src="/frame"></iframe>', 'text/html');
  server.setContent('/plain', '<!doctype html><button onclick="this.textContent=\'Unexpected outer effect\'">Outer</button>', 'text/html');
  server.setContent('/frame', '<!doctype html><button onclick="this.textContent=\'Saved in frame\'">Frame save</button>', 'text/html');
  const { client } = await startClient({ args: ['--isolated'] });
  const navigate = await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });
  expect(navigate.isError, JSON.stringify(navigate)).not.toBe(true);
  const snapshot = await client.callTool({ name: 'browser_snapshot', arguments: {} });
  const content = (snapshot as any).content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('\n');
  const frameTarget = content.match(/button "Frame save" \[ref=([^\]]+)\]/);
  expect(frameTarget, content).toBeTruthy();
  const click = await client.callTool({ name: 'browser_click', arguments: { target: frameTarget![1] } });
  expect(click.isError, JSON.stringify(click)).not.toBe(true);
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
