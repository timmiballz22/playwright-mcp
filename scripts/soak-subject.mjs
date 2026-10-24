// Private benchmark subject. No model-selected code or public endpoint.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeWorkflow } from '../local-batch/executor.mjs';
const count = Number(process.argv[2]);
if (!Number.isInteger(count) || count < 20 || count > 100) throw new TypeError('Invalid soak count');
const abort = new AbortController();
let waiting;
const stop = () => { abort.abort(); waiting?.reject(new Error('observer_disconnected')); };
process.once('disconnect', stop); process.once('SIGTERM', stop); process.once('SIGINT', stop);
process.on('message', packet => { if (packet?.type === 'ack' && packet.run === waiting?.run) waiting.resolve(); });
function send(packet) {
  if (process.connected) { try { process.send(packet, error => { if (error) stop(); }); } catch { stop(); } }
  else stop();
}
function exchange(packet) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { stop(); }, 10000);
    waiting = { run: packet.run, resolve: () => { clearTimeout(timer); waiting = undefined; resolve(); },
      reject: error => { clearTimeout(timer); waiting = undefined; reject(error); } };
    send(packet);
  });
}
const cpuStart = process.cpuUsage();
async function main() {
  if (!process.connected) throw new Error('observer_disconnected');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'supervised-soak-subject-'));
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(`<!doctype html><button>fresh</button><output></output><script>
      const output=document.querySelector('output');
      output.textContent=document.cookie.includes('soak-marker=')||localStorage.getItem('soak-marker')!==null?'dirty':'clean';
      document.querySelector('button').onclick=function(){document.cookie='soak-marker=seeded; SameSite=Strict; path=/';localStorage.setItem('soak-marker','seeded');this.textContent='done';output.textContent=document.cookie.includes('soak-marker=seeded')&&localStorage.getItem('soak-marker')==='seeded'?'seeded':'seed-failed';};
    </script>`);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  let cleanupAttested = true;
  try {
    await exchange({ type: 'ready', run: 0, baselineFds: (await readdir('/proc/self/fd')).length });
    for (let run = 1; run <= count; run++) {
      await exchange({ type: 'runStart', run });
      if (abort.signal.aborted) throw new Error('observer_disconnected');
      cleanupAttested = false;
      const result = await executeWorkflow({ timeoutMs: 15000, steps: [
        { type: 'goto', url: origin }, { type: 'assertText', selector: 'button', equals: 'fresh' },
        { type: 'assertText', selector: 'output', equals: 'clean' },
        { type: 'click', selector: 'button' }, { type: 'assertText', selector: 'button', equals: 'done' },
        { type: 'assertText', selector: 'output', equals: 'seeded' },
      ] }, { allowedOrigins: [origin], artifactsDir: directory, signal: abort.signal,
        onEvent: event => { if (event.pid) send({ type: 'owned', run, pid: event.pid }); },
      });
      assert.equal(result.ok, true, JSON.stringify({ reason: result.reason, completed: result.completed, execution: result.execution }));
      assert.equal(result.completed, 6); assert.equal(result.execution.cleanup, 'terminated');
      assert.equal(result.execution.tempCleanup, 'removed');
      await new Promise(resolve => setImmediate(resolve));
      const memory = process.memoryUsage();
      await exchange({ type: 'runDone', run, row: { run, completed: result.completed, freshCookieAndLocalStorageVerified: true, durationMs: result.durationMs,
        subjectRss: memory.rss, subjectHeapUsed: memory.heapUsed, subjectFds: (await readdir('/proc/self/fd')).length } });
      cleanupAttested = true;
    }
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    // An absent observer cannot attest that process cleanup completed; preserve
    // the private workspace on that failure rather than deleting a live root.
    if (cleanupAttested) await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
main().then(() => {
  const cpu = process.cpuUsage(cpuStart);
  send({ type: 'done', cpuMs: Math.round((cpu.user + cpu.system) / 1000) });
}).catch(() => { process.exitCode = 1; send({ type: 'failed', code: 'soak_subject_failed' }); }).finally(() => {
  if (process.connected) process.disconnect();
});
