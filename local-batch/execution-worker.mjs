import { checkRetainedArtifactBudget } from './retained-artifact-budget.mjs';
// Trusted executor only. Workflow content never chooses modules, code or shell.
import { runWorkflow } from './runner.mjs';
import { saveReport } from './report.mjs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const abort = new AbortController();
let finished = false;
const send = event => {
  if (process.connected) { try { process.send(event, () => {}); } catch {} }
};
process.once('disconnect', () => { if (!finished) abort.abort(); });
process.on('message', message => {
  if (message.type === 'abort') abort.abort();
});
process.once('message', async packet => {
  if (packet.type !== 'start' || !process.connected) return;
  let summary;
  let stage = 'execution';
  let completed = 0;
  try {
    stage = 'workspace';
    await mkdir(path.dirname(packet.workspaceRoot), { recursive: true, mode: 0o700 });
    if (packet.options.maxRetainedArtifactBytes !== undefined)
      await checkRetainedArtifactBudget(path.dirname(packet.workspaceRoot), packet.options.maxRetainedArtifactBytes, packet.options.maxScreenshotBytes);
    await mkdir(packet.workspaceRoot, { mode: 0o700 }); // exclusive run ownership
    await new Promise((resolve, reject) => process.send({ type: 'workspaceCreated' }, error => error ? reject(error) : resolve()));
    const tempDir = packet.temporaryRoot ?? path.join(packet.workspaceRoot, 'tmp');
    await mkdir(tempDir, { mode: 0o700 }); // exclusive ownership, including external roots
    await new Promise((resolve, reject) => {
      const clear = () => { process.removeListener('message', acknowledged); process.removeListener('disconnect', disconnected); };
      const acknowledged = message => { if (message.type === 'temporaryReady') { clear(); resolve(); } };
      const disconnected = () => { clear(); reject(new Error('disconnected')); };
      process.on('message', acknowledged); process.once('disconnect', disconnected);
      process.send({ type: 'temporaryCreated' }, error => { if (error) { clear(); reject(error); } });
    });
    // Scope Playwright's own temporary profiles/downloads to this execution.
    // Only this worker and its browser inherit these legitimate temp settings.
    process.env.TMPDIR = tempDir; process.env.TEMP = tempDir; process.env.TMP = tempDir;
    stage = 'execution';
    const result = await runWorkflow(packet.workflow, { ...packet.options, artifactsDir: packet.workspaceRoot, signal: abort.signal,
      onBrowserLaunch: () => send({ type: 'browserLaunchStarted' }),
      onBrowserProcess: pid => send({ type: 'ownedProcess', pid }),
      onProgress: event => { completed = event.completed; send({ type: 'progress', completed }); },
      onActionFailure: (error, step) => send({ type: 'actionFailure', failedStep: { ...step, ok: false } }),
    });
    stage = 'report';
    summary = await saveReport({ schemaVersion: 1, runId: packet.runId, reportScope: 'worker_execution', ...result }, packet.workspaceRoot);
  } catch (error) {
    summary = { ok: false, reason: stage === 'workspace' && error?.code === 'ARTIFACT_STORAGE_LIMIT' ? 'resource_limit' : 'execution_failed', stage, completed, recentSteps: [], failedStep: null, reportPath: null };
  }
  finished = true;
  if (process.connected) {
    process.send({ type: 'result', summary }, () => { if (process.connected) process.disconnect(); });
  }
});
