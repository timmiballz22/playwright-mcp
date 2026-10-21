// Trusted real-browser parent-death fixture. Never a model-selected module.
import { JobJournal } from '../jobs/journal.mjs';
import { captureWorkflow } from '../jobs/workflow-snapshot.mjs';
import { fork } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
const directory = process.argv[2];
const config = { directory: path.join(directory, 'journal'), projectId: 'e'.repeat(64), ownerId: 'parent-death-fixture' };
const journal = await JobJournal.open(config);
const roots = [process.pid, journal.child.pid];
let requested = false; let browser = false; let emitted = false;
const ready = () => { if (requested && browser && !emitted) { emitted = true; process.stdout.write(JSON.stringify({ jobId: id, roots }) + '\n'); } };
const probePath = '/probe-' + randomUUID();
const server = createServer((request, response) => { response.end('<!doctype html><button>Fixture</button>'); if (request.url === probePath) { requested = true; ready(); } });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const workflow = { timeoutMs: 30000, actionTimeoutMs: 30000, steps: [{ type: 'goto', url: origin + probePath }, { type: 'waitFor', selector: '#never' }] };
const id = randomUUID(); const nonce = randomUUID();
await journal.call('create', { id, requestKey: 'parent-death', workflowDigest: captureWorkflow(workflow).digest, total: 2, deadlineAt: Date.now() + 35000 });
await journal.call('reserve', { id, nonce });
const guardian = fork(fileURLToPath(new URL('../jobs/guardian.mjs', import.meta.url)), [], { detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: ['--max-old-space-size=128'] });
roots.push(guardian.pid);
guardian.on('message', event => { if (event.pid) roots.push(event.pid); if (event.type === 'ownedProcess') { browser = true; ready(); } });
guardian.send({ type: 'start', id, nonce, journal: { ...config, instanceId: journal.instanceId }, workflow,
  execution: { artifactsDir: path.join(directory, 'artifacts'), allowedOrigins: [origin] } });

guardian.once('exit', async () => {
  if (!emitted) {
    process.exitCode = 1;
    server.closeAllConnections(); server.close();
    await journal.close();
    if (process.connected) process.disconnect();
  }
});
