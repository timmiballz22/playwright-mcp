// Trusted real-browser controller-death fixture. Never a model-selected module.
import { JobController } from '../jobs/controller.mjs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
const directory = process.argv[2];
const roots = [process.pid];
let requested = false; let browser = false; let emitted = false; let id;
let controller;
const ready = () => { if (id && requested && browser && !emitted) { emitted = true; process.stdout.write(JSON.stringify({ jobId: id, roots }) + '\n'); } };
const probePath = '/probe-' + randomUUID();
const server = createServer((request, response) => { response.end('<!doctype html><button>Fixture</button>'); if (request.url === probePath) { requested = true; ready(); } });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
controller = await JobController.open({
  journal: { directory: path.join(directory, 'journal'), projectId: 'e'.repeat(64), ownerId: 'parent-death-fixture' },
  execution: { artifactsDir: path.join(directory, 'artifacts'), allowedOrigins: [origin] },
  onEvent: event => {
    if (event.pid) roots.push(event.pid);
    if (event.type === 'ownedProcess') { browser = true; ready(); }
    if (event.type === 'jobComplete' && !emitted) {
      process.exitCode = 1; server.closeAllConnections(); server.close();
      void controller.close().finally(() => { if (process.connected) process.disconnect(); });
    }
  },
});
roots.push(controller.journal.child.pid);
const workflow = { timeoutMs: 30000, actionTimeoutMs: 30000, steps: [{ type: 'goto', url: origin + probePath }, { type: 'waitFor', selector: '#never' }] };
id = (await controller.start(workflow, 'parent-death')).jobId;
ready();
