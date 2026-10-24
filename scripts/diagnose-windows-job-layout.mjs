// Optional controlled failure probe, never a retry of the installed job. Both
// workflows are fresh, read-only and target only this script's own HTTP fixture.
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, realpath, stat, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { executeWorkflow } from '../local-batch/executor.mjs';
import { resolveJobConfig } from '../local-batch/jobs/config.mjs';
if (process.platform !== 'win32') throw new Error('layout_probe_windows_only');
// Automatic CI probing requires explicit cleanup proof from the failed test.
if (process.argv[2]) {
  const info = await stat(process.argv[2]);
  const gate = info.isFile() && info.size <= 2097152 && /(?:^|\r?\n)WINDOWS_JOB_LAYOUT_CLEANUP_CONFIRMED(?:\r?\n|$)/.test(await readFile(process.argv[2], 'utf8'));
  if (!gate) { console.log(JSON.stringify({ component: 'windows_layout_probe', skipped: 'prior_cleanup_not_confirmed' })); process.exit(0); }
}
const root = await mkdtemp(path.join(os.tmpdir(), 'job-layout-'));
const base = path.join(root, 'private');
const fixture = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<!doctype html><p id="ready">Owned layout fixture</p>'); });
fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
const origin = `http://127.0.0.1:${fixture.address().port}`;
const results = []; let verified = false;
try {
  const config = await resolveJobConfig({ cwd: root, env: { PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_DATA_DIR: base, PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: origin } });
  // The helper makes base itself protected owner/System storage before either
  // case runs. Only directory depth differs; origins/actions/browser are equal.
  const canonicalBase = await realpath(base);
  for (const [layout, artifactsDir, temporaryBase] of [['short_private_base', canonicalBase], ['job_namespace', config.execution.artifactsDir], ['job_namespace_short_temp', config.execution.artifactsDir, config.execution.temporaryBase]]) {
    const result = await executeWorkflow({ timeoutMs: 20000, steps: [{ type: 'goto', url: origin }, { type: 'assertText', selector: '#ready', equals: 'Owned layout fixture' }] }, {
      artifactsDir, temporaryBase, allowedOrigins: [origin], readOnly: true,
      workerModule: new URL('../local-batch/fixtures/launch-diagnostic.mjs', import.meta.url),
    });
    let launch;
    try { launch = JSON.parse(await readFile(path.join(artifactsDir, 'exec-' + result.runId, 'launch-fixture.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    results.push({ layout, artifactDirectoryCharacters: artifactsDir.length, ok: result.ok, reason: result.reason, completed: result.completed,
      failedStepType: result.failedStep?.type, failureKind: result.failedStep?.failureKind, cleanup: result.execution?.cleanup, tempCleanup: result.execution?.tempCleanup, launch });
    const receipt = JSON.stringify(results.at(-1));
    console.log(receipt);
    if (process.env.GITHUB_ACTIONS === 'true') console.log('::notice title=Windows launch layout::' + receipt.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
    // Unknown cleanup must never be followed by another browser allocation.
    if (result.execution?.cleanup !== 'terminated' || result.execution?.tempCleanup !== 'removed') throw new Error('layout_probe_cleanup_unconfirmed');
  }
  verified = results.every(result => result.ok);
  if (!verified) process.exitCode = 1;
} finally {
  fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
  if (verified) await rm(root, { recursive: true, force: true });
}
