// Trusted real-browser controller-death fixture. Never a model-selected module.
import { JobController } from '../jobs/controller.mjs';
import { guardianDiagnostic } from '../jobs/guardian-diagnostic.mjs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
const directory = process.argv[2];
const roots = [process.pid];
let requested = false; let browser = false; let emitted = false; let id;
let controller; let stage = 'validation'; let firstFailure;
const reportFailure = (error, failureStage, command = 'none', state = 'unknown') => new Promise(resolve => {
  const packet = { type: 'fixtureFailure', diagnostic: guardianDiagnostic(error, failureStage, command),
    state: ['FAILED', 'CRASHED', 'CANCELLED', 'TIMED_OUT', 'SUCCEEDED'].includes(state) ? state : 'unknown' };
  if (process.connected) { try { process.send(packet, () => resolve()); } catch { resolve(); } }
  else resolve();
});
const ready = () => { if (id && requested && browser && !emitted) { emitted = true; process.stdout.write(JSON.stringify({ jobId: id, roots }) + '\n'); } };
const probePath = '/probe-' + randomUUID();
const server = createServer((request, response) => { response.end('<!doctype html><button>Fixture</button>'); if (request.url === probePath) { requested = true; ready(); } });
try {
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
stage = 'journal_open';
if (process.env.PLAYWRIGHT_TEST_GUARDIAN_START_FAILURE === '1')
  throw Object.assign(new Error('private-guardian-start-canary'), { code: 'journal_unavailable', journalFailure: 'rpc_timeout', journalFailureCommand: 'init' });
controller = await JobController.open({
  journal: { directory: path.join(directory, 'journal'), projectId: 'e'.repeat(64), ownerId: 'parent-death-fixture', ...(process.argv[3] === '--linger-journal-close' ? { workerModule: new URL('./linger-journal-worker.mjs', import.meta.url).href } : {}) },
  execution: { artifactsDir: path.join(directory, 'artifacts'), allowedOrigins: [origin] },
  onEvent: event => {
    if (event.type === 'guardianFailed') {
      firstFailure ??= guardianDiagnostic(event.diagnostic, event.diagnostic?.stage, event.diagnostic?.command);
      void reportFailure(firstFailure, firstFailure.stage, firstFailure.command);
    }
    if (event.pid) roots.push(event.pid);
    if (event.type === 'ownedProcess') { browser = true; ready(); }
    if (event.type === 'jobComplete' && !emitted) {
      process.exitCode = 1; server.closeAllConnections(); server.close();
      const failure = firstFailure ?? { code: 'guardian_failed' };
      void reportFailure(failure, firstFailure?.stage ?? 'execution', firstFailure?.command ?? 'none', event.state)
        .then(() => controller.close()).catch(error => reportFailure(error, 'journal_close', 'close'))
        .finally(() => { if (process.connected) process.disconnect(); });
    }
  },
});
roots.push(controller.journal.child.pid);
const workflow = { timeoutMs: 30000, actionTimeoutMs: 30000, steps: [{ type: 'goto', url: origin + probePath }, { type: 'waitFor', selector: '#never' }] };
stage = 'write';
id = (await controller.start(workflow, 'parent-death')).jobId;
ready();

} catch (error) {
  process.exitCode = 1;
  await reportFailure(error, stage, stage === 'write' ? 'create' : stage === 'journal_open' ? 'init' : 'none');
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  try { await controller?.close(); } catch (shutdown) { await reportFailure(shutdown, 'journal_close', 'close'); }
  if (process.connected) process.disconnect();
}
