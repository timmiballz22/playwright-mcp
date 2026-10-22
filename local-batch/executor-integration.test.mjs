import { stepFailureDiagnostic } from '../scripts/step-failure-diagnostic.mjs';
import { createLifetimeObserver } from './jobs/fixtures/lifetime-observer.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

for (const browser of ['chromium', 'firefox', 'webkit']) {
  test(`supervised ${browser}: 20 real clicks, exact counter, PNG and atomic report`, { timeout: 30000 }, async () => {
    const fixture = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><button id="add">Add</button><output>0</output><script>let n=0;document.querySelector("button").onclick=()=>document.querySelector("output").textContent=String(++n)</script>');
    });
    fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const dir = await mkdtemp(path.join(os.tmpdir(), 'supervised-positive-'));
    let admitted = false;
    let browserBeforeAdmission = false;
    let verified = false; let primary;
    const observer = await createLifetimeObserver(path.join(dir, 'factory-control'));
    try {
      const [outcome] = await observer.run([{ workflow: { browser, timeoutMs: 20000, steps: [
        { type: 'goto', url: origin }, { type: 'click', selector: { role: 'button', name: 'Add' }, repeat: 20 },
        { type: 'assertText', selector: 'output', equals: '20' }, { type: 'screenshot' },
      ] }, options: { allowedOrigins: [origin], artifactsDir: dir, allowSensitiveArtifacts: true,
        beforeWorkerStart: async ({ pid }) => { assert.ok(pid > 1); admitted = true; },
        onEvent: event => { if (event.type === 'ownedProcess' && !admitted) browserBeforeAdmission = true; },
      } }]);
      if (outcome.status === 'rejected') throw outcome.reason;
      const result = outcome.value;
      assert.equal(admitted, true);
      assert.equal(browserBeforeAdmission, false);
      assert.equal(result.execution.mode, 'supervised');
      assert.equal(result.execution.cleanup, 'terminated');
      assert.equal(result.execution.tempCleanup, 'removed');
      await assert.rejects(stat(path.join(dir, 'exec-' + result.runId, 'tmp')), { code: 'ENOENT' });
      try { await observer.audit('supervised_' + browser); }
      catch (error) {
        // The audit precedes action assertions; retain the bounded execution
        // outcome as well as its same-snapshot ownership facts, without replay.
        console.error(JSON.stringify({ fixture: 'supervised_integrity_audit_failure', browser,
          ok: result.ok, reason: result.reason, completed: result.completed, total: result.total,
          failedStep: stepFailureDiagnostic(result.failedStep), forced: result.execution.forced,
          cleanup: result.execution.cleanup, tempCleanup: result.execution.tempCleanup }));
        throw error;
      }
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.completed, 23);
      const report = JSON.parse(await readFile(result.reportPath, 'utf8'));
      assert.equal(report.runId, result.runId);
      assert.equal(report.results.length, 23);
      const png = await readFile(report.results.at(-1).artifact);
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      verified = true;
    } catch (error) { primary = error; throw error;
    } finally {
      let clean = false;
      try { await observer.close(); clean = true; }
      catch (error) { if (primary) throw new AggregateError([primary, error], 'Supervised acceptance and lifetime audit failed'); throw error; }
      finally {
        fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
        if (verified && clean) await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        else console.error('Supervised browser fixture preserved: acceptance or cleanup not confirmed');
      }
    }
  });
  test(`supervised ${browser}: all declarative action types preserve exact owned DOM effects`, { timeout: 30000 }, async () => {
    const fixture = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><style>body{height:2000px}label,button{display:block;margin:8px}#scroll-state,#scrolled{position:fixed;top:0;right:0}</style>
<label>Name<input data-testid="name" placeholder="Owned name" oninput="document.querySelector('#name-value').textContent=this.value" onkeydown="if(event.key==='Enter')document.querySelector('#pressed').textContent='entered:'+this.value"></label>
<output id="name-value" data-testid="name-value">waiting</output><output id="pressed">waiting</output>
<label>Accept<input type="checkbox" onchange="document.querySelector('#checked').textContent=this.checked?'yes':'no'"></label><output id="checked">no</output>
<button onmouseenter="this.dataset.entries=String(Number(this.dataset.entries||0)+1);document.querySelector('#hover-state').textContent='hovered:'+this.dataset.entries;document.querySelector('#ready').hidden=false">Hover target</button>
<output id="hover-state">waiting</output><span id="ready" hidden>Ready</span>
<button onclick="document.querySelector('#count').textContent=String(++window.count)">Add</button><output id="count">0</output><output id="scroll-state">waiting</output>
<script>window.count=0;addEventListener('scroll',()=>{if(scrollY>0){const output=document.querySelector('#scroll-state')||document.querySelector('#scrolled');output.id='scrolled';output.textContent='scrolled'}})</script>`);
    });
    fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const directory = await mkdtemp(path.join(os.tmpdir(), 'declarative-effects-'));
    const observer = await createLifetimeObserver(path.join(directory, 'factory-control'));
    const steps = [
      { type: 'goto', url: origin },
      { type: 'fill', selector: { label: 'Name' }, value: 'Fixture' },
      { type: 'assertText', selector: '#name-value', equals: 'Fixture' },
      { type: 'press', selector: { placeholder: 'Owned name' }, key: 'Enter' },
      { type: 'assertText', selector: '#pressed', equals: 'entered:Fixture' },
      { type: 'fill', selector: { testId: 'name' }, value: '' },
      { type: 'assertText', selector: '#name-value', equals: '' },
      { type: 'fill', selector: { label: 'Name' }, value: 'Final' },
      { type: 'assertText', selector: { testId: 'name-value' }, equals: 'Final' },
      { type: 'check', selector: { label: 'Accept' } },
      { type: 'assertText', selector: '#checked', equals: 'yes' },
      { type: 'uncheck', selector: { label: 'Accept' } },
      { type: 'assertText', selector: '#checked', equals: 'no' },
      { type: 'hover', selector: { text: 'Hover target' } },
      { type: 'waitFor', selector: '#ready' },
      { type: 'assertText', selector: '#hover-state', equals: 'hovered:1' },
      { type: 'click', selector: { role: 'button', name: 'Add' } },
      { type: 'assertText', selector: '#count', equals: '1' },
      { type: 'assertURL', url: origin + '/' },
      { type: 'scroll', deltaY: 200 },
      { type: 'waitFor', selector: '#scrolled' },
      { type: 'assertText', selector: '#scrolled', equals: 'scrolled' },
      { type: 'screenshot' },
    ];
    let verified = false; let primary;
    try {
      const [outcome] = await observer.run([{ workflow: { browser, timeoutMs: 20000, steps },
        options: { allowedOrigins: [origin], artifactsDir: directory, allowSensitiveArtifacts: true } }]);
      if (outcome.status === 'rejected') throw outcome.reason;
      const result = outcome.value;
      assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.completed, steps.length);
      assert.equal(result.execution.cleanup, 'terminated'); assert.equal(result.execution.tempCleanup, 'removed');
      const report = JSON.parse(await readFile(result.reportPath, 'utf8'));
      assert.deepEqual(report.results.map(step => step.type), steps.map(step => step.type));
      const png = await readFile(report.results.at(-1).artifact);
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      await observer.audit('declarative_' + browser); verified = true;
    } catch (error) { primary = error; throw error; }
    finally {
      let clean = false;
      try { await observer.close(); clean = true; }
      catch (error) { if (primary) throw new AggregateError([primary, error], 'Declarative effects and lifetime audit failed'); throw error; }
      finally {
        fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
        if (verified && clean) await rm(directory, { recursive: true, force: true });
        else console.error('Declarative effects fixture preserved: acceptance or cleanup not confirmed');
      }
    }
  });
}
