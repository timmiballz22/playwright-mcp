import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runWorkflow } from './runner.mjs';
import { rawWorkflowFailureDiagnostic } from '../scripts/step-failure-diagnostic.mjs';

const browsers = (process.env.PLAYWRIGHT_BATCH_TEST_BROWSERS ?? 'chromium,firefox,webkit').split(',');
if (!browsers.length || browsers.some(browser => !['chromium', 'firefox', 'webkit'].includes(browser)) || new Set(browsers).size !== browsers.length)
  throw new TypeError('Invalid test browser selection');
for (const browser of browsers) {
  // Retain headless/headed acceptance and compare public pipe transport on Windows.
  for (const mode of browser === 'firefox' && process.platform === 'win32' ? ['headless', 'headed', 'direct-pipe'] : browser === 'firefox' && process.env.PLAYWRIGHT_BATCH_TEST_FIREFOX_TRANSPORT_COMPARISON === '1' ? ['headless', 'direct-pipe'] : ['headless']) {
  const clicks = browser === 'chromium' ? 997 : 20;
  const freshRuns = browser === 'firefox' ? Number(process.env.PLAYWRIGHT_BATCH_TEST_FRESH_FIREFOX_RUNS ?? (process.platform === 'win32' ? 5 : 1)) : 1;
  if (!Number.isInteger(freshRuns) || freshRuns < 1 || freshRuns > 20) throw new TypeError('Invalid test run count');
  test(`real ${browser}${mode === 'headless' ? '' : ' ' + mode}: ${freshRuns} fresh runs, navigation, ${clicks} clicks, assertion, screenshot, cleanup`, {
    skip: process.env.RUN_BROWSER_TESTS !== '1' ? 'Set RUN_BROWSER_TESTS=1 with Playwright installed' : false,
  }, async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><title>Local Fixture</title><button id="add">Add</button><output id="count">0</output><script>let n=0;document.querySelector("#add").onclick=()=>{document.querySelector("#count").textContent=String(++n)}</script>');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const origin = 'http://127.0.0.1:' + server.address().port;
    const dir = await mkdtemp(path.join(os.tmpdir(), 'pw-batch-'));
    let diagnostic;
    let probe;
    let browserLogs = '';
    const recordBrowserLog = value => { browserLogs = (browserLogs + String(value) + '\n').slice(-4096); };
    const logger = { isEnabled: name => name === 'browser', log: (_name, _severity, message) => recordBrowserLog(message) };
    const provider = browser === 'firefox' ? await import('playwright').then(({ firefox }) => ({
      firefox: mode === 'direct-pipe' ? {
        // Trusted fixture adapter uses the public pipe API; no invented handle.
        launch: options => firefox.launch({ ...options, logger }),
      } : {
        launchServer: async options => {
          const server = await firefox.launchServer({ ...options, ...(mode === 'headed' ? { headless: false } : {}), logger });
          // Public owned child handle, static fixture only. No production log path.
          server.process().stderr?.on('data', recordBrowserLog);
          return server;
        },
        connect: (...args) => firefox.connect(...args),
      },
    })) : undefined;
    try {
      const steps = [{ type: 'goto', url: origin + '/' },
        ...Array.from({ length: clicks }, () => ({ type: 'click', selector: { role: 'button', name: 'Add' } })),
        { type: 'assertText', selector: '#count', equals: String(clicks) },
        { type: 'screenshot' }];
      const captures = new Set();
      // Each iteration must succeed before the next starts; no failed action is retried.
      for (let freshRun = 0; freshRun < freshRuns; freshRun++) {
        diagnostic = undefined; probe = undefined; browserLogs = '';
        const result = await runWorkflow({ browser, schemaVersion: 1, steps, timeoutMs: 120000 },
          { artifactsDir: dir, allowedOrigins: [origin], allowSensitiveArtifacts: true,
            ...(provider ? { playwright: provider } : {}),
            // This fixture has only static local data and no credentials. Raw call
            // logs stay in trusted test diagnostics, outside model-visible results.
            onActionFailure: (error, step, page) => {
              diagnostic = { ...step, name: error?.name, fixtureCallLog: String(error?.message).slice(-5000) };
              // Read the fixed fixture counter once after failure; never replay input.
              probe = page.locator('#count').textContent({ timeout: 500 }).then(value => {
                diagnostic.fixtureCounter = /^\d{1,4}$/.test(value ?? '') ? Number(value) : 'invalid_fixture_counter';
              }).catch(error => { diagnostic.counterProbe = error?.name === 'TimeoutError' ? 'timeout' : 'unavailable'; });
            },
          });
        if (probe) await probe;
        if (!result.ok) {
          const receipt = rawWorkflowFailureDiagnostic(result, diagnostic, { browser, mode, freshRun: freshRun + 1 });
          console.error((process.env.GITHUB_ACTIONS === 'true' ? '::error title=Raw browser workflow failure::' : '') + JSON.stringify(receipt));
        }
        assert.equal(result.ok, true, JSON.stringify({ freshRun: freshRun + 1, result, cleanupFailures: result.cleanupFailures, diagnostic, ...(browserLogs ? { browserLogs } : {}) }).slice(-11000));
        assert.equal(result.completed, clicks + 3);
        const artifact = result.results.at(-1).artifact;
        assert.equal(captures.has(artifact), false, 'Fresh run reused a screenshot path');
        captures.add(artifact);
        assert.ok((await stat(artifact)).size > 0);
      }
    } finally {
      server.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

}
}
