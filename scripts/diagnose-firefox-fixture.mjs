// Operator diagnostic: only a static server created by this process. No production
// policy switch, arbitrary URL, action replay, force-click or security flag.
import { fork } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { ownedDescendants } from '../local-batch/fixtures/process-audit.mjs';
import { terminateOwnedProcesses } from '../local-batch/process-tree.mjs';

if (process.argv[2] === '--owned-fixture-child') {
  const { firefox } = await import('playwright');
  const transport = process.argv[3]; const routing = process.argv[4];
  assert.ok(['pipe', 'server'].includes(transport));
  assert.ok(['none', 'fetch'].includes(routing));
  const fixture = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><button>Add</button><output>0</output><script>let n=0;document.querySelector("button").onclick=()=>document.querySelector("output").textContent=String(++n)</script>');
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const url = `http://127.0.0.1:${fixture.address().port}/`;
  let completed = 0; let phase = 'launch'; let verified = false;
  try {
    for (let iteration = 0; iteration < 5; iteration++) {
      let server; let browser; let context;
      try {
        phase = 'launch';
        if (transport === 'server') {
          server = await firefox.launchServer({ headless: true, host: '127.0.0.1', timeout: 10000 });
          process.send({ browserPid: server.process().pid });
          browser = await firefox.connect(server.wsEndpoint(), { timeout: 10000 });
        } else browser = await firefox.launch({ headless: true, timeout: 10000 });
        context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block' });
        context.setDefaultTimeout(5000);
        if (routing === 'fetch') await context.route('**/*', async route => {
          if (route.request().url() !== url || route.request().method() !== 'GET') return route.abort('blockedbyclient');
          const response = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: 10000 });
          try { await route.fulfill({ response }); } finally { await response.dispose(); }
        });
        const ready = once(process, 'message');
        process.send({ browserReady: true }); await ready;
        const page = await context.newPage(); phase = 'navigation';
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        for (let click = 0; click < 20; click++) {
          phase = 'click'; await page.getByRole('button', { name: 'Add', exact: true }).click(); completed++;
        }
        phase = 'assertion'; assert.equal(await page.locator('output').textContent(), '20');
        phase = 'screenshot'; assert.ok((await page.screenshot()).length > 0);
      } catch (error) {
        process.send({ receipt: { transport, routing, completed, phase, ok: false, error: error?.name === 'TimeoutError' ? 'timeout' : 'fixture_failure' } });
        throw error;
      } finally {
        phase = 'cleanup';
        await context?.close(); await browser?.close(); await server?.close();
      }
    }
    verified = true;
  } catch (error) {
    process.send({ receipt: { transport, routing, completed, phase, ok: false, error: error?.name === 'TimeoutError' ? 'timeout' : 'fixture_failure' } });
    process.exitCode = 1;
  } finally {
    fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
  }
  if (verified) process.send({ receipt: { transport, routing, completed, ok: true } });
  process.disconnect();
} else {
  const results = [];
  for (const transport of ['pipe', 'server']) for (const routing of ['none', 'fetch']) {
    const child = fork(fileURLToPath(import.meta.url), ['--owned-fixture-child', transport, routing], { detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const closed = once(child, 'close').catch(() => []); const browsers = []; let receipt; let observed = []; let auditFailure = false;
    try {
      child.on('message', async message => {
        if (Number.isSafeInteger(message.browserPid) && message.browserPid > 1) browsers.push(message.browserPid);
        if (message.receipt) receipt ??= message.receipt;
        if (message.browserReady) {
          try {
            observed.push(...await ownedDescendants([child.pid], { rememberLiveRoots: true }));
            if (child.connected) child.send({ ready: true });
          } catch {
            auditFailure = true;
            await terminateOwnedProcesses(child.pid, browsers, child.exitCode === null && child.signalCode === null);
          }
        }
      });
      observed.push(...await ownedDescendants([child.pid], { rememberLiveRoots: true }));
      let timer;
      const exited = await Promise.race([closed.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 120000); })]);
      clearTimeout(timer);
      observed.push(...await ownedDescendants([child.pid, ...browsers]));
      if (!exited) await terminateOwnedProcesses(child.pid, browsers, true);
      let remaining = await ownedDescendants([child.pid, ...browsers, ...observed]);
      const end = performance.now() + 5000;
      while (remaining.length && performance.now() < end) {
        await new Promise(resolve => setTimeout(resolve, 100));
        remaining = await ownedDescendants([child.pid, ...browsers, ...observed]);
      }
      assert.deepEqual(remaining, [], 'Diagnostic cleanup uncertain; stop comparisons');
      assert.equal(auditFailure, false, 'Diagnostic process audit failed; stop comparisons');
      const result = { os: process.platform, transport, routing, ...(receipt ?? { ok: false, error: 'missing_receipt' }),
        ...(!exited ? { ok: false, independentDeadline: true } : child.exitCode !== 0 ? { ok: false } : {}), activeOwnedProcesses: 0 };
      results.push(result); console.log(JSON.stringify(result));
      if (process.env.GITHUB_ACTIONS === 'true') console.error('::notice title=Firefox fixture factor::' + JSON.stringify(result));
    } finally {
      if (child.exitCode === null && child.signalCode === null)
        await terminateOwnedProcesses(child.pid, browsers, true);
    }
  }
  if (results.some(result => !result.ok)) process.exitCode = 1;
}
