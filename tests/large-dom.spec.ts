/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import fs from 'node:fs/promises';
import { test, expect } from './fixtures';

test('original large DOM can use explicit snapshot files and bounded find without losing element actions', async ({ startClient, server }, testInfo) => {
  const rows = Array.from({ length: 4000 }, (_, index) => `<button onclick="document.querySelector('output').textContent='Activated row${index}'">Fixture row${index}</button>`).join('');
  // Witness the actual post-click DOM value independently, without another full
  // browser_find traversal of the same 4,000-row document.
  let activationHits = 0;
  server.route('/activated', (_request, response) => { activationHits++; response.end('ok'); });
  server.setContent('/', '<!doctype html><title>Large owned DOM</title><output>Waiting</output>' + rows + `<script>
    const output=document.querySelector('output');
    new MutationObserver(()=>fetch('/activated',{method:'POST',body:output.textContent}).catch(()=>{})).observe(output,{childList:true});
  </script>`, 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--snapshot-mode=none'] });
  const started = performance.now();
  let callToolRequests = 0;
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    callToolRequests++;
    const callStarted = performance.now();
    let responseState = 'not_received';
    try {
      const result = await client.callTool({ name, arguments: args });
      responseState = result.isError ? 'tool_error' : 'tool_result';
      expect(result.isError, JSON.stringify(result)).not.toBe(true);
      return result.content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('\n');
    } catch (error) {
      const project = ['chrome', 'chromium', 'firefox', 'webkit'].includes(testInfo.project.name) ? testInfo.project.name : 'other';
      const tool = ['browser_navigate', 'browser_snapshot', 'browser_find', 'browser_click', 'browser_close'].includes(name) ? name : 'other';
      console.log(JSON.stringify({ fixture: 'large_dom_call_failure', project, tool, responseState, callNumber: callToolRequests,
        callDurationMs: Math.min(300000, Math.round(performance.now() - callStarted)), elapsedMs: Math.min(300000, Math.round(performance.now() - started)) }));
      throw error;
    }
  };
  expect((await call('browser_navigate', { url: server.PREFIX })).length).toBeLessThan(4096);
  const filename = testInfo.outputPath('owned-large-snapshot.md');
  const saved = await call('browser_snapshot', { filename });
  expect(saved.length).toBeLessThan(4096);
  const snapshot = await fs.readFile(filename, 'utf8');
  expect(Buffer.byteLength(snapshot)).toBeGreaterThan(65536);
  expect(snapshot.match(/button "Fixture row\d+"/g)).toHaveLength(4000);
  const limited = await call('browser_find', { text: 'Fixture row', maxResults: 1 });
  expect(limited.length).toBeLessThan(8192); expect(limited).not.toContain('Fixture row3999');
  const last = await call('browser_find', { text: 'Fixture row3999', maxResults: 1 });
  expect(last.length).toBeLessThan(8192);
  const reference = last.match(/button "Fixture row3999" \[ref=([^\]]+)\]/);
  expect(reference, last).toBeTruthy();
  const activation = server.waitForRequest('/activated');
  void activation.catch(() => {}); // Fixture reset must not create an unhandled rejection after a tool failure.
  expect((await call('browser_click', { target: reference![1] })).length).toBeLessThan(4096);
  const request = await activation;
  expect(request.method).toBe('POST');
  expect((await (request as any).postBody).toString('utf8')).toBe('Activated row3999');
  expect(activationHits).toBe(1);
  await call('browser_close');
  console.log(JSON.stringify({ fixture: 'large_dom_verified', callToolRequests, snapshotBytes: Buffer.byteLength(snapshot), lastRowWitness: true }));
});
