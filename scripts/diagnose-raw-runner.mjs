// Exact raw-runner controls: Firefox temp ordering or Chromium transport. Static owned fixture only; no production policy change.
import { fork, ChildProcess } from 'node:child_process';
import { channel } from 'node:diagnostics_channel';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { runWorkflow } from '../local-batch/runner.mjs';
import { ownedScopeDescendants } from '../local-batch/fixtures/process-audit.mjs';
import { terminateOwnedProcesses } from '../local-batch/process-tree.mjs';
import { createProtocolProjection, stepFailureDiagnostic } from './step-failure-diagnostic.mjs';
const send = value => { if (process.connected) process.send(value, () => {}); };
if (process.argv[2] === '--owned-child') {
  const mode = process.argv[3]; const directory = process.argv[4];
  if (!['private', 'inherited', 'server', 'direct-pipe', 'protocol', 'protocol-headed', 'stock', 'stock-headed'].includes(mode)) throw new TypeError('Invalid owned diagnostic mode');
  const browser = ['server', 'direct-pipe'].includes(mode) ? 'chromium' : 'firefox';
  const protocolEnabled = mode === 'protocol' || mode === 'protocol-headed';
  const stockEnabled = mode === 'stock' || mode === 'stock-headed';
  const headless = !['protocol-headed', 'stock-headed'].includes(mode);
  const controlledStall = (protocolEnabled || stockEnabled) && process.env.PLAYWRIGHT_TEST_PROTOCOL_STALL === '1';
  const controlledCloseStall = stockEnabled && process.env.PLAYWRIGHT_TEST_STOCK_CLOSE_STALL === '1';
  const privateTempRoot = mode === 'private' || protocolEnabled || stockEnabled; const freshRuns = browser === 'chromium' ? 1 : 10; const clicks = browser === 'chromium' ? 997 : 20;
  const fixture = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    const html = '<!doctype html><title>Local Fixture</title><button id="add">Add</button><output id="count">0</output><script>let n=0;document.querySelector("#add").onclick=()=>{document.querySelector("#count").textContent=String(++n)}</script>';
    response.end(controlledStall ? html.replace('String(++n)', 'String(++n);if(n===4){const end=performance.now()+7000;while(performance.now()<end){}}') : html);
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  if (privateTempRoot) {
    const temporary = path.join(directory, 'tmp'); await mkdir(temporary, { mode: 0o700 });
    process.env.TMPDIR = temporary; process.env.TEMP = temporary; process.env.TMP = temporary;
  }
  // Only this private owned-fixture child enables wire logging. Its stderr is
  // ignored by the parent; only fixed, bounded protocol projections leave it.
  if (protocolEnabled) process.env.DEBUG = 'pw:protocol';
  const engine = (await import('playwright'))[browser];
  const stderrWrite = process.stderr.write;
  let protocolTrace; let protocolFailure; let protocolReceipt; let projectionFailed = false;
  if (protocolEnabled) process.stderr.write = function(chunk, ...args) {
    try { protocolTrace?.observe(chunk); } catch { projectionFailed = true; }
    return stderrWrite.call(this, chunk, ...args);
  };
  const directHandles = new Set();
  const childChannel = channel('child_process');
  const provider = mode === 'direct-pipe' ? { launch: async options => {
    // Public Node diagnostics provides the actual locally constructed handle,
    // before spawn assigns its PID. Capture only this controlled launch window.
    const capture = ({ process: child }) => {
      if (!(child instanceof ChildProcess)) return;
      directHandles.add(child);
      child.once('spawn', () => { if (Number.isSafeInteger(child.pid)) send({ type: 'browser', pid: child.pid }); });
    };
    childChannel.subscribe(capture);
    try { return await engine.launch(options); }
    finally { childChannel.unsubscribe(capture); }
  } } : mode === 'protocol-headed' ? {
    launchServer: options => engine.launchServer({ ...options, headless: false }), connect: engine.connect.bind(engine),
  } : engine;
  // A separately labelled stock-API isolation control. This private static page
  // has no third-party dependencies. It does not exercise companion routing.
  const runStock = async () => {
    const started = performance.now(); let completed = 0; let stage = 'setup';
    let server; let connection; let context; let failure;
    const cleanupFailures = [];
    const timeoutError = () => { const error = new Error('stock_control_timeout'); error.name = 'TimeoutError'; return error; };
    const remaining = () => {
      const value = 120000 - (performance.now() - started);
      if (value <= 0) throw timeoutError();
      return value;
    };
    const bounded = async promise => {
      let timer;
      try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(timeoutError()), remaining()); })]); }
      finally { clearTimeout(timer); }
    };
    try {
      server = await engine.launchServer({ headless, timeout: remaining() });
      // Private cleanup negative control; the actual public kill handle remains.
      if (controlledCloseStall) server.close = () => new Promise(() => {});
      const handle = server.process();
      assert.ok(Number.isSafeInteger(handle?.pid)); send({ type: 'browser', pid: handle.pid });
      connection = await engine.connect(server.wsEndpoint(), { timeout: remaining() });
      context = await bounded(connection.newContext({ acceptDownloads: false }));
      context.setDefaultTimeout(5000);
      const page = await bounded(context.newPage());
      stage = 'goto'; await page.goto(origin + '/', { timeout: Math.min(30000, remaining()) }); completed++;
      stage = 'click';
      for (let index = 0; index < clicks; index++) {
        await page.getByRole('button', { name: 'Add', exact: true }).click({ timeout: Math.min(5000, remaining()) }); completed++;
      }
      stage = 'assertText'; assert.equal(await page.locator('#count').textContent({ timeout: Math.min(5000, remaining()) }), String(clicks)); completed++;
      stage = 'screenshot';
      const png = await page.screenshot({ timeout: Math.min(5000, remaining()) });
      assert.ok(png.length > 8 && png.length <= 16 * 1024 * 1024);
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a'); completed++;
    } catch (error) {
      failure = { ok: false, type: stage, error: 'stock_api_failed', failureKind: error?.name === 'TimeoutError' ? 'timeout' : 'provider_or_assertion_error' };
    } finally {
      for (const [name, resource] of [['context', context], ['browser', connection], ['server', server]]) {
        let timer;
        const closeTimeout = new Error('stock_close_timeout');
        try { await Promise.race([resource?.close(), new Promise((_, reject) => { timer = setTimeout(() => reject(closeTimeout), 5000); })]); }
        catch (error) {
          cleanupFailures.push(name + (error === closeTimeout ? '_timeout' : '_error'));
          if (name === 'server' && resource) {
            let killTimer; const killTimeout = new Error('stock_kill_timeout');
            try { await Promise.race([resource.kill(), new Promise((_, reject) => { killTimer = setTimeout(() => reject(killTimeout), 1000); })]); }
            catch (error) { cleanupFailures.push(error === killTimeout ? 'server_kill_timeout' : 'server_kill_error'); }
            finally { clearTimeout(killTimer); }
          }
        }
        finally { clearTimeout(timer); }
      }
    }
    const actionsSucceeded = !failure && completed === clicks + 3;
    return { ok: actionsSucceeded && !cleanupFailures.length, reason: failure ? 'stock_api_failed' : cleanupFailures.length ? 'cleanup_failed' : null,
      completed, total: clicks + 3, actionsSucceeded, cleanupFailures, results: failure ? [failure] : [], durationMs: Math.round(performance.now() - started) };
  };
  // Only this initial handshake waits for the audit, before any browser exists.
  const start = once(process, 'message'); send({ type: 'ready' }); await start;
  let successfulRuns = 0; let confirmedActions = 0; let last;
  try {
    for (let iteration = 0; iteration < freshRuns; iteration++) {
      if (protocolEnabled) { protocolTrace = createProtocolProjection(); protocolFailure = undefined; }
      const result = stockEnabled ? await runStock() : await runWorkflow({ browser, schemaVersion: 1, timeoutMs: 120000, steps: [
        { type: 'goto', url: origin + '/' }, ...Array.from({ length: clicks }, () => ({ type: 'click', selector: { role: 'button', name: 'Add' } })),
        { type: 'assertText', selector: '#count', equals: String(clicks) }, { type: 'screenshot' },
      ] }, { artifactsDir: directory, allowedOrigins: [origin], allowSensitiveArtifacts: true, playwright: { [browser]: provider },
        ...(mode !== 'direct-pipe' ? { onBrowserProcess: pid => send({ type: 'browser', pid }) } : {}),
        ...(protocolEnabled ? { onActionFailure: (_error, step) => {
          protocolFailure = { step: stepFailureDiagnostic(step), wire: protocolTrace.snapshot() };
        } } : {}),
      });
      if (protocolEnabled) protocolReceipt = { observedRuns: iteration + 1, controlledStall, projectionFailed,
        atFailure: protocolFailure, afterCleanup: protocolTrace.snapshot() };
      confirmedActions += result.completed;
      const failure = result.results.find(step => !step.ok);
      last = { ok: result.ok, reason: result.reason, completed: result.completed, total: result.total, actionsSucceeded: result.actionsSucceeded,
        cleanupFailures: result.cleanupFailures, durationMs: result.durationMs, failureKind: failure?.failureKind, failureCode: failure?.error, failedStepType: failure?.type };
      if (!result.ok) break; // Never retry a failed action/run.
      assert.equal(result.completed, clicks + 3); successfulRuns++;
    }
  } catch { last = { ok: false, reason: 'fixture_failed' }; }
  finally { if (protocolEnabled) process.stderr.write = stderrWrite; }
  const handleReceipt = mode === 'direct-pipe' ? {
    capturedOwnedHandles: directHandles.size,
    spawnedOwnedHandles: [...directHandles].filter(child => Number.isSafeInteger(child.pid)).length,
    exitedOwnedHandles: [...directHandles].filter(child => child.exitCode !== null || child.signalCode !== null).length,
  } : undefined;
  const handlesConfirmed = !handleReceipt || handleReceipt.capturedOwnedHandles > 0 &&
    handleReceipt.spawnedOwnedHandles === handleReceipt.capturedOwnedHandles &&
    handleReceipt.exitedOwnedHandles === handleReceipt.capturedOwnedHandles;
  const protocolConfirmed = !protocolEnabled || !projectionFailed && protocolReceipt?.afterCleanup.sent > 0 && protocolReceipt?.afterCleanup.responses > 0;
  // Keep the owned controller alive until its final identity snapshot is taken.
  const finish = once(process, 'message');
  send({ type: 'receipt', value: { logging: protocolEnabled, headless, privateTempRoot, browser, executionAPI: stockEnabled ? 'stock_playwright' : 'companion_runWorkflow', controlledStall, controlledCloseStall, transport: mode === 'direct-pipe' ? 'direct_pipe' : 'browser_server', requiredFreshRuns: freshRuns, successfulRuns, confirmedActions, ok: successfulRuns === freshRuns && handlesConfirmed && protocolConfirmed, ...(handleReceipt ? { handleReceipt } : {}), ...(protocolEnabled ? { protocol: protocolReceipt } : {}), last } });
  await finish;
  fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
  process.disconnect();
} else {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.length === 1 && !['--private-first', '--chromium-transport', '--chromium-pipe-first', '--firefox-protocol', '--firefox-headed-protocol', '--firefox-stock', '--firefox-headed-stock'].includes(args[0])) throw new TypeError('Invalid diagnostic arguments');
  const chromiumTransport = ['--chromium-transport', '--chromium-pipe-first'].includes(args[0]);
  const modeOrder = args[0] === '--firefox-headed-stock' ? ['stock-headed'] : args[0] === '--firefox-stock' ? ['stock'] : args[0] === '--firefox-headed-protocol' ? ['protocol-headed'] : args[0] === '--firefox-protocol' ? ['protocol'] : args[0] === '--chromium-pipe-first' ? ['direct-pipe', 'server'] : chromiumTransport ? ['server', 'direct-pipe'] : args.length ? ['private', 'inherited'] : ['inherited', 'private'];
  let failed = false; let interrupted = false; let current;
  const cancel = () => {
    interrupted = true;
    if (current && current.exitCode === null && current.signalCode === null)
      void terminateOwnedProcesses(current.pid, [], true).catch(() => {});
  };
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  const scopes = [];
  for (const mode of modeOrder) {
    if (interrupted) throw new Error('Exact runner diagnostic cancelled');
    const directory = await mkdtemp(path.join(os.tmpdir(), (chromiumTransport ? 'chromium-transport-' : 'ff-runner-') + mode + '-'));
    const child = fork(fileURLToPath(import.meta.url), ['--owned-child', mode, directory], { detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    current = child;
    const closed = once(child, 'close').catch(() => []); const browsers = []; let auditFailure = false;
    const scope = { roots: new Set([child.pid]), liveRoots: new Set([child.pid]), identities: new Map() }; scopes.push(scope);
    let anchorRecorded = false;
    let audit = Promise.resolve(); let auditing = false; let resolveReceipt;
    const received = new Promise(resolve => { resolveReceipt = resolve; });
    const snapshot = async () => {
      assert.ok(child.exitCode === null && child.signalCode === null, 'Owned diagnostic controller exited before observation');
      let legacy;
      const observed = await ownedScopeDescendants([scope], { rememberLiveRoots: true,
        ...(!anchorRecorded ? { compareLegacyRoots: [...scope.roots], onLegacyObservation: value => { legacy = value; } } : {}),
      });
      assert.ok(child.exitCode === null && child.signalCode === null, 'Owned diagnostic controller exited during observation');
      if (!anchorRecorded) {
        if (process.platform === 'win32') assert.ok(legacy, 'Initial exact-runner legacy comparison missing');
        const record = JSON.stringify({ fixture: 'exact_runner_initial_anchor', mode, observed,
          legacy, roots: [...scope.roots], identities: [...scope.identities] });
        assert.ok(Buffer.byteLength(record) <= 65536, 'Initial exact-runner audit receipt byte bound exceeded');
        await writeFile(path.join(directory, 'initial-anchor.json'), record, { flag: 'wx', mode: 0o600 });
        if (legacy?.legacyOnly.length) console.log(record);
        anchorRecorded = true;
      }
    };
    const sample = () => {
      if (!auditing) {
        auditing = true;
        audit = snapshot().catch(() => { auditFailure = true; }).finally(() => { auditing = false; });
      }
    };
    let auditTimer;
    child.on('message', message => {
      if (message.type === 'ready') {
        snapshot().then(() => {
          // Both Chromium modes use the same read-only periodic audit. The direct
          // public API lacks BrowserServer.process(); retain descendants while live.
          if (chromiumTransport) auditTimer = setInterval(sample, 500);
          if (child.connected) child.send({ type: 'start' }, () => {});
        }).catch(() => { auditFailure = true; resolveReceipt(null); });
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
      clearTimeout(timer); clearInterval(auditTimer); await audit;
      if (child.exitCode === null && child.signalCode === null) await snapshot();
      // Keep never-observed reported roots conservative; no birth/role filter.
      for (const pid of browsers) scope.roots.add(pid);
      const before = await ownedScopeDescendants(scopes);
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
      let remaining = await ownedScopeDescendants(scopes);
      while (remaining.length && performance.now() < end) { await new Promise(resolve => setTimeout(resolve, 100)); remaining = await ownedScopeDescendants(scopes); }
      assert.deepEqual(remaining, [], 'Exact runner diagnostic cleanup uncertain');
      assert.equal(auditFailure, false, 'Exact runner process identity uncertain'); clean = true;
      const result = { os: process.platform, mode, comparisonOrder: modeOrder, position: modeOrder.indexOf(mode) + 1, privateTempRoot: ['private', 'protocol', 'protocol-headed', 'stock', 'stock-headed'].includes(mode), ...(receipt ?? { ok: false, reason: interrupted ? 'operator_cancelled' : 'independent_deadline_or_exit' }), residualProcessesBeforeForce: residual.length, activeOwnedProcesses: 0 };
      if (residual.length) result.ok = false;
      console.log(JSON.stringify(result));
      if (process.env.GITHUB_ACTIONS === 'true') console.error('::notice title=' + (chromiumTransport ? 'Chromium transport control' : 'Firefox exact runner') + '::' + JSON.stringify(result));
      verifiedCase = result.ok; if (!result.ok) failed = true;
    } finally {
      clearTimeout(timer); clearInterval(auditTimer);
      if (child.exitCode === null && child.signalCode === null) await terminateOwnedProcesses(child.pid, [], true);
      if (clean && verifiedCase) await rm(directory, { recursive: true, force: true });
      current = undefined;
    }
  }
  process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
  if (failed || interrupted) process.exitCode = 1;
}
