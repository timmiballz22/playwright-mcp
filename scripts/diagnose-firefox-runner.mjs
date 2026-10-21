// Exact raw-runner control. Static owned fixture only; no production policy change.
import { fork } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { runWorkflow } from '../local-batch/runner.mjs';
import { ownedDescendants } from '../local-batch/fixtures/process-audit.mjs';
import { terminateOwnedProcesses } from '../local-batch/process-tree.mjs';
const send = value => { if (process.connected) process.send(value, () => {}); };
if (process.argv[2] === '--owned-child') {
  const privateTempRoot = process.argv[3] === 'private'; const directory = process.argv[4];
  const fixture = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><title>Local Fixture</title><button id="add">Add</button><output id="count">0</output><script>let n=0;document.querySelector("#add").onclick=()=>{document.querySelector("#count").textContent=String(++n)}</script>');
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  if (privateTempRoot) {
    const temporary = path.join(directory, 'tmp'); await mkdir(temporary, { mode: 0o700 });
    process.env.TMPDIR = temporary; process.env.TEMP = temporary; process.env.TMP = temporary;
  }
  const { firefox } = await import('playwright');
  // Only this initial handshake waits for the audit, before any browser exists.
  const start = once(process, 'message'); send({ type: 'ready' }); await start;
  let successfulRuns = 0; let confirmedActions = 0; let last;
  try {
    for (let iteration = 0; iteration < 10; iteration++) {
      const result = await runWorkflow({ browser: 'firefox', schemaVersion: 1, timeoutMs: 120000, steps: [
        { type: 'goto', url: origin + '/' }, ...Array.from({ length: 20 }, () => ({ type: 'click', selector: { role: 'button', name: 'Add' } })),
        { type: 'assertText', selector: '#count', equals: '20' }, { type: 'screenshot' },
      ] }, { artifactsDir: directory, allowedOrigins: [origin], allowSensitiveArtifacts: true, playwright: { firefox },
        onBrowserProcess: pid => send({ type: 'browser', pid }),
      });
      confirmedActions += result.completed;
      const failure = result.results.find(step => !step.ok);
      last = { ok: result.ok, reason: result.reason, completed: result.completed, total: result.total, actionsSucceeded: result.actionsSucceeded,
        cleanupFailures: result.cleanupFailures, durationMs: result.durationMs, failureKind: failure?.failureKind };
      if (!result.ok) break; // Never retry a failed action/run.
      assert.equal(result.completed, 23); successfulRuns++;
    }
  } catch { last = { ok: false, reason: 'fixture_failed' }; }
  // Keep the owned controller alive until its final identity snapshot is taken.
  const finish = once(process, 'message');
  send({ type: 'receipt', value: { logging: false, privateTempRoot, requiredFreshRuns: 10, successfulRuns, confirmedActions, ok: successfulRuns === 10, last } });
  await finish;
  fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
  process.disconnect();
} else {
  let failed = false; let interrupted = false; let current;
  const cancel = () => {
    interrupted = true;
    if (current && current.exitCode === null && current.signalCode === null)
      void terminateOwnedProcesses(current.pid, [], true).catch(() => {});
  };
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  for (const mode of ['inherited', 'private']) {
    if (interrupted) throw new Error('Exact runner diagnostic cancelled');
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ff-runner-' + mode + '-'));
    const child = fork(fileURLToPath(import.meta.url), ['--owned-child', mode, directory], { detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    current = child;
    const closed = once(child, 'close').catch(() => []); const browsers = []; let observed = []; let auditFailure = false;
    let audit = Promise.resolve(); let auditing = false; let resolveReceipt;
    const received = new Promise(resolve => { resolveReceipt = resolve; });
    const snapshot = async () => { observed.push(...await ownedDescendants([child.pid], { rememberLiveRoots: true })); };
    child.on('message', message => {
      if (message.type === 'ready') {
        snapshot().then(() => { if (child.connected) child.send({ type: 'start' }, () => {}); }).catch(() => { auditFailure = true; resolveReceipt(null); });
      } else if (message.type === 'browser' && Number.isSafeInteger(message.pid)) {
        browsers.push(message.pid);
        if (!auditing) {
          auditing = true;
          audit = snapshot().catch(() => { auditFailure = true; }).finally(() => { auditing = false; });
        }
      } else if (message.type === 'receipt') resolveReceipt(message.value);
    });
    let timer; let receipt; let clean = false; let verifiedCase = false;
    try {
      receipt = await Promise.race([received, closed.then(() => null), new Promise(resolve => { timer = setTimeout(() => resolve(null), 180000); })]);
      clearTimeout(timer); await audit;
      if (child.exitCode === null && child.signalCode === null) await snapshot();
      const before = await ownedDescendants([child.pid, ...browsers, ...observed]);
      const residual = before.filter(pid => pid !== child.pid);
      if (!receipt || residual.length || auditFailure) {
        // Historical numeric browser PIDs carry no termination authority after
        // exit/reuse. Kill only our still-live child tree, then audit separately.
        if (child.exitCode === null && child.signalCode === null) await terminateOwnedProcesses(child.pid, [], true);
      } else if (child.connected) child.send({ type: 'finish' }, () => {});
      let closeTimer;
      await Promise.race([closed, new Promise(resolve => { closeTimer = setTimeout(resolve, 3000); })]); clearTimeout(closeTimer);
      if (child.exitCode === null && child.signalCode === null) await terminateOwnedProcesses(child.pid, [], true);
      const end = performance.now() + 10000;
      let remaining = await ownedDescendants([child.pid, ...browsers, ...observed]);
      while (remaining.length && performance.now() < end) { await new Promise(resolve => setTimeout(resolve, 100)); remaining = await ownedDescendants([child.pid, ...browsers, ...observed]); }
      assert.deepEqual(remaining, [], 'Exact runner diagnostic cleanup uncertain');
      assert.equal(auditFailure, false, 'Exact runner process identity uncertain'); clean = true;
      const result = { os: process.platform, mode, privateTempRoot: mode === 'private', ...(receipt ?? { ok: false, reason: interrupted ? 'operator_cancelled' : 'independent_deadline_or_exit' }), residualProcessesBeforeForce: residual.length, activeOwnedProcesses: 0 };
      if (residual.length) result.ok = false;
      console.log(JSON.stringify(result));
      if (process.env.GITHUB_ACTIONS === 'true') console.error('::notice title=Firefox exact runner::' + JSON.stringify(result));
      verifiedCase = result.ok; if (!result.ok) failed = true;
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) await terminateOwnedProcesses(child.pid, [], true);
      if (clean && verifiedCase) await rm(directory, { recursive: true, force: true });
      current = undefined;
    }
  }
  process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
  if (failed || interrupted) process.exitCode = 1;
}
