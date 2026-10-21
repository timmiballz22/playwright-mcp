/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import { test, expect } from './fixtures';

test('original route mock, header override, unroute and offline/online state preserve live owned requests', async ({ startClient, server }) => {
  let hits = 0;
  let receivedHeaders: Record<string, string | string[] | undefined> = {};
  server.route('/owned-api', (request, response) => {
    hits++; receivedHeaders = request.headers;
    response.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    response.end('owned-live-response');
  });
  server.setContent('/', '<!doctype html><title>Owned route fixture</title>', 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--caps=network'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  };
  const evaluationResult = (text: string) => {
    const match = text.match(/^### Result\n([\s\S]*?)(?=\n### |$)/);
    expect(match, text).toBeTruthy();
    return JSON.parse(match![1]);
  };
  // Static source-authored code for this owned fixture; no page-provided code.
  const fetchOwned = async () => evaluationResult(await call('browser_evaluate', { function: "async () => { const r=await fetch('/owned-api',{cache:'no-store',headers:{'X-Fixture-Remove':'remove-me'}}); return {status:r.status,body:await r.text()}; }" }));
  const pattern = '**/owned-api';
  await call('browser_navigate', { url: server.PREFIX });
  await call('browser_route', { pattern, status: 201, body: 'owned-mock-response', contentType: 'text/plain' });
  expect(await call('browser_route_list')).toContain(pattern);
  const mocked = await fetchOwned();
  expect(mocked).toEqual({ status: 201, body: 'owned-mock-response' }); expect(hits).toBe(0);
  await call('browser_unroute', { pattern });
  expect(await call('browser_route_list')).not.toContain(pattern);
  expect(await fetchOwned()).toEqual({ status: 200, body: 'owned-live-response' }); expect(hits).toBe(1);
  expect(receivedHeaders['x-fixture-remove']).toBe('remove-me');
  await call('browser_route', { pattern, headers: ['X-Fixture-Added: added-value'], removeHeaders: 'X-Fixture-Remove' });
  expect(await fetchOwned()).toEqual({ status: 200, body: 'owned-live-response' }); expect(hits).toBe(2);
  expect(receivedHeaders['x-fixture-added']).toBe('added-value'); expect(receivedHeaders['x-fixture-remove']).toBeUndefined();
  await call('browser_unroute');
  expect(await call('browser_route_list')).not.toContain(pattern);
  await call('browser_network_state_set', { state: 'offline' });
  const offline = await call('browser_evaluate', { function: "async () => { try { await fetch('/owned-api',{cache:'no-store'}); return 'unexpected-online'; } catch { return 'owned-offline'; } }" });
  expect(evaluationResult(offline)).toBe('owned-offline'); expect(hits).toBe(2);
  await call('browser_network_state_set', { state: 'online' });
  expect(await fetchOwned()).toEqual({ status: 200, body: 'owned-live-response' }); expect(hits).toBe(3);
  expect(receivedHeaders['x-fixture-added']).toBeUndefined(); expect(receivedHeaders['x-fixture-remove']).toBe('remove-me');
  await call('browser_close');
});
