/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import { test, expect } from './fixtures';

test('original explicitly allowed service worker serves an owned offline document without network fallback', async ({ startClient, server }) => {
  let fallbackRequests = 0;
  server.setContent('/', '<!doctype html><title>Owned worker setup</title><p>Worker setup</p>', 'text/html; charset=utf-8');
  server.route('/owned-offline', (_request, response) => { fallbackRequests++; response.writeHead(503); response.end('Network fallback must not be used'); });
  server.setContent('/owned-sw.js', `self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
    self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
    self.addEventListener('fetch',event=>{
      if(new URL(event.request.url).pathname==='/owned-offline')event.respondWith(Promise.resolve(new Response(
        ${JSON.stringify(`<!doctype html><title>Owned offline worker</title><button onclick="document.querySelector('output').textContent='Offline saved:1'">Offline Save</button><output>Offline ready</output>`)},
        {headers:{'Content-Type':'text/html; charset=utf-8'}})));
    });`, 'application/javascript');
  const { client } = await startClient({ args: ['--isolated'], config: {
    browser: { contextOptions: { serviceWorkers: 'allow' } },
  } });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  };
  await call('browser_navigate', { url: server.PREFIX });
  // Source-defined owned code only. Explicit functional mode does not change
  // the separate batch engine's default service-worker security policy.
  await call('browser_run_code_unsafe', { code: `async page => {
    await page.evaluate(() => navigator.serviceWorker.register('/owned-sw.js'));
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 5000 });
    await page.context().setOffline(true);
    return { controlled: true, offline: true };
  }` });
  await call('browser_navigate', { url: server.PREFIX + 'owned-offline' });
  const snapshot = await call('browser_snapshot');
  expect(snapshot).toContain('Offline ready');
  const reference = snapshot.match(/button "Offline Save" \[ref=([^\]]+)\]/);
  expect(reference, snapshot).toBeTruthy();
  await call('browser_click', { target: reference![1] });
  expect(await call('browser_snapshot')).toContain('Offline saved:1');
  expect(fallbackRequests).toBe(0);
  await call('browser_close');
  console.log(JSON.stringify({ fixture: 'owned_service_worker_offline', explicitlyAllowed: true,
    networkFallbackRequests: fallbackRequests, offlineDomEffect: 1 }));
});
