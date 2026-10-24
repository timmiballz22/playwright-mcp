/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import fs from 'node:fs/promises';
import { test, expect } from './fixtures';

test('original network status/details and console filtering preserve explicit file output', async ({ startClient, server }, testInfo) => {
  server.route('/api/good', (_request, response) => { response.writeHead(200, { 'Content-Type': 'text/plain' }); response.end('fixture-response-body'); });
  server.route('/api/missing', (_request, response) => { response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('fixture-missing-body'); });
  server.setContent('/', `<!doctype html><title>Network console fixture</title><output>Waiting</output><script>
    Promise.all([fetch('/api/good'),fetch('/api/missing')]).then(()=>{
      console.info('fixture-info');console.warn('fixture-warning');console.error('fixture-error');
      for(let i=0;i<20;i++)console.info('fixture-bulk-'+i+':'+'x'.repeat(1024));
      setTimeout(()=>{throw new Error('fixture-js-exception')},0);
      setTimeout(()=>{document.querySelector('output').textContent='Ready'},50);
    });</script>`, 'text/html');
  const { client } = await startClient({ args: ['--isolated'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return result.content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('\n');
  };
  await call('browser_navigate', { url: server.PREFIX });
  await call('browser_wait_for', { text: 'Ready' });
  const errors = await call('browser_console_messages', { level: 'error' });
  expect(errors).toContain('fixture-error'); expect(errors).toContain('fixture-js-exception');
  expect(errors).not.toContain('fixture-info'); expect(errors).not.toContain('fixture-warning');
  const filename = testInfo.outputPath('explicit-console.log');
  const saved = await call('browser_console_messages', { level: 'info', filename });
  expect(saved.length).toBeLessThan(4096);
  expect(await fs.readFile(filename, 'utf8')).toContain('fixture-bulk-19:');
  const network = await call('browser_network_requests', { filter: '/api/' });
  const missing = network.split('\n').find(line => line.includes('/api/missing'));
  expect(missing, network).toContain('404');
  expect(network.split('\n').find(line => line.includes('/api/good'))).toContain('200');
  const index = Number(missing!.match(/^(\d+)\./)![1]);
  expect(await call('browser_network_request', { index, part: 'response-body' })).toContain('fixture-missing-body');
  const invalid = await client.callTool({ name: 'browser_network_requests', arguments: { filter: '[' } });
  expect(invalid.isError).toBe(true);
  await call('browser_close');
});
