import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';
import { ownedScopeDescendants } from './fixtures/process-audit.mjs';

for (const browser of (process.env.PLAYWRIGHT_BATCH_TEST_BROWSERS ?? 'chromium,firefox,webkit').split(',')) {
  test(`real ${browser}: HTTP error codes and script exceptions keep response secrets out of reports`, { timeout: 120000 }, async () => {
    const hits = new Map(); const finishedResponses = new Map(); const firstRequests = new Map(); const lastResponses = new Map();
    const canaries = ['fake-query-private-canary', 'fake-header-private-canary', 'fake-body-private-canary', 'fake-script-private-canary'];
    const server = createServer((request, response) => {
      const route = new URL(request.url, 'http://fixture.invalid').pathname;
      hits.set(route, (hits.get(route) ?? 0) + 1);
      if (!firstRequests.has(route)) firstRequests.set(route, performance.now());
      response.once('finish', () => { finishedResponses.set(route, (finishedResponses.get(route) ?? 0) + 1); lastResponses.set(route, performance.now()); });
      const status = /^\/[45]\d\d$/.test(route) ? Number(route.slice(1)) : route === '/script' ? 200 : 404;
      response.writeHead(status, {
        'Content-Type': 'text/html', 'X-Fixture-Secret': canaries[1], 'Cache-Control': 'no-store',
      });
      response.end(`<p>${canaries[2]}</p>${route === '/script' ? `<script>document.querySelector('p').id='script-ran';throw new Error('${canaries[3]}')</script>` : ''}`);
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const directory = await mkdtemp(path.join(os.tmpdir(), 'http-privacy-'));
    const scopes = [];
    const sinceMs = Date.now();
    let verifiedCases = 0;
    let primaryFailure;
    let primaryStage = 'execution';
    let currentRoute = null;
    let outcome = null;
    try {
      for (const [route, code] of [['/401', 'http_401'], ['/403', 'http_403'], ['/404', 'http_404'],
        ['/418', 'http_4xx'], ['/429', 'rate_limited'], ['/500', 'http_5xx'], ['/503', 'http_5xx'], ['/script', null]]) {
        currentRoute = route; primaryStage = 'execution'; outcome = null;
        const started = performance.now(); const phases = { workerMs: null, browserMs: null, startAuditMs: null };
        const scope = { roots: new Set(), identities: new Map() }; scopes.push(scope);
        let startAuditFailure;
        const result = await executeWorkflow({ browser, timeoutMs: 15000, actionTimeoutMs: 3000,
          steps: [{ type: 'goto', url: `${origin}${route}?secret=${canaries[0]}` },
            { type: 'assertText', selector: '#script-ran', equals: canaries[2] }] }, {
          allowedOrigins: [origin], artifactsDir: directory,
          onEvent: event => {
            if (event.pid) scope.roots.add(event.pid);
            if (event.type === 'workerSpawned') phases.workerMs = Math.round(performance.now() - started);
            if (event.type === 'ownedProcess') phases.browserMs = Math.round(performance.now() - started);
          },
          // The existing trusted start ACK holds supervisor/worker allocation
          // before browser effects. Observe this owned lifetime independently;
          // a later workflow cannot overwrite an earlier root incarnation.
          beforeWorkerStart: async () => {
            const auditStarted = performance.now();
            try { await ownedScopeDescendants([scope], { rememberLiveRoots: true }); }
            catch (error) { startAuditFailure = error; throw error; }
            finally { phases.startAuditMs = Math.round(performance.now() - auditStarted); }
          },
        });
        if (startAuditFailure) throw startAuditFailure;
        primaryStage = 'summary';
        outcome = { ok: result.ok, reason: result.reason, completed: result.completed,
          failureCode: result.failedStep?.error ?? null, failureKind: result.failedStep?.failureKind ?? null,
          httpStatus: result.failedStep?.httpStatus ?? null, forced: result.execution?.forced,
          cleanup: result.execution?.cleanup, tempCleanup: result.execution?.tempCleanup,
          requestsSeen: hits.get(route) ?? 0, responsesFinished: finishedResponses.get(route) ?? 0,
          timing: { ...phases,
            firstRequestMs: firstRequests.has(route) ? Math.round(firstRequests.get(route) - started) : null,
            lastResponseMs: lastResponses.has(route) ? Math.round(lastResponses.get(route) - started) : null } };
        assert.equal(result.execution.cleanup, 'terminated');
        assert.equal(result.execution.tempCleanup, 'removed');
        assert.equal(result.ok, code === null, JSON.stringify({ route, reason: result.reason, failedStep: result.failedStep }));
        assert.equal(result.completed, code === null ? 2 : 0);
        assert.equal(result.failedStep?.error ?? null, code);
        if (code) {
          assert.equal(result.reason, 'action_failed', JSON.stringify({ route, reason: result.reason,
            completed: result.completed, failedStep: result.failedStep, forced: result.execution.forced,
            cleanup: result.execution.cleanup, tempCleanup: result.execution.tempCleanup }));
          assert.equal(result.failedStep.failureKind, 'http_failure');
          assert.equal(result.failedStep.httpStatus, Number(route.slice(1)));
          assert.equal(result.failedStep.index, 1);
          assert.equal(result.retrySafe, false);
        }
        assert.equal(hits.get(route), 1, 'Default navigation must not retry HTTP errors');
        primaryStage = 'report';
        const report = await readFile(result.reportPath, 'utf8');
        primaryStage = 'privacy';
        for (const secret of canaries) {
          assert.equal(JSON.stringify(result).includes(secret), false, 'Summary leaked fixture secret');
          assert.equal(report.includes(secret), false, 'Saved report leaked fixture secret');
        }
        verifiedCases++;
        primaryStage = 'complete';
      }
    } catch (error) {
      primaryFailure = error;
      throw error;
    } finally {
      let audited = false;
      let auditReceipt = null;
      let auditFailure = null;
      try {
        const survivors = await ownedScopeDescendants(scopes, { sinceMs, onReceipt: receipt => { auditReceipt = receipt; } });
        assert.equal(survivors.length, 0, JSON.stringify({ fixture: 'http_privacy_ownership', verifiedCases, audit: auditReceipt }));
        audited = true;
      } catch (error) {
        auditFailure = error.code === 'ERR_ASSERTION' ? 'owned_processes_observed' :
          /^process_audit_windows_cim_(timeout|output_limit|enoent|eacces|command_failed|exit_[0-9]+)_phase_(entered|query|projection|serialization|done|unknown)$/.test(error.message) ? error.message : 'audit_failed';
        if (primaryFailure) throw new AggregateError([primaryFailure, error], 'HTTP fixture and ownership audit both failed', { cause: primaryFailure });
        throw error;
      }
      finally {
        server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
        if (verifiedCases === 8 && audited) await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        else console.error(JSON.stringify({ fixture: 'http_privacy_workspace_preserved', verifiedCases,
          primaryFailed: !!primaryFailure, primaryStage, route: currentRoute, outcome,
          auditConfirmed: audited, auditFailure, audit: auditReceipt }));
      }
    }
  });
}
