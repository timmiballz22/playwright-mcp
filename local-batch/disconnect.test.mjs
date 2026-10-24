import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { mkdtemp, rm, readdir, stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const entry = new URL('./mcp.mjs', import.meta.url);
for (const stop of ['eof', 'SIGTERM']) {
  test(`active browser workflow terminates after ${stop}`, { timeout: 20000 }, async () => {
    let arrived;
    const request = new Promise(resolve => { arrived = resolve; });
    const fixture = createServer((req, res) => { arrived(); /* deliberately hang */ });
    fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
    const dir = await mkdtemp(path.join(os.tmpdir(), 'disconnect-'));
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const child = spawn(process.execPath, [fileURLToPath(entry)], { env: { ...process.env, PLAYWRIGHT_BATCH_ALLOWED_ORIGINS: origin, PLAYWRIGHT_BATCH_ARTIFACTS_DIR: dir }, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stderr.resume();
    const exited = once(child, 'exit');
    let ready;
    const initialized = new Promise(resolve => { ready = resolve; });
    const lines = createInterface({ input: child.stdout });
    lines.on('line', line => { if (JSON.parse(line).id === 1) ready(); });
    const send = value => child.stdin.write(JSON.stringify(value) + '\n');
    let timer;
    try {
      send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'disconnect-test', version: '1' } } });
      await initialized;
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'browser_run_batch', arguments: { steps: [{ type: 'goto', url: origin }] } } });
      await request;
      const start = Date.now();
      if (stop === 'eof') child.stdin.end(); else child.kill(stop);
      const [code, signal] = await Promise.race([exited, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Owned server did not exit after disconnect')), 10000); })]);
      // Windows emulates kill(SIGTERM) by abrupt termination; it is not a
      // catchable POSIX signal. EOF remains the graceful shutdown contract.
      // https://nodejs.org/api/child_process.html#subprocesskillsignal
      if (process.platform === 'win32' && stop === 'SIGTERM') {
        assert.equal(signal, 'SIGTERM');
        assert.equal(code, null);
      } else {
        assert.equal(code, 0, `signal=${signal}`);
      }
      assert.ok(Date.now() - start < 10000);
      // An abruptly killed Windows frontend exits before its independent
      // supervisor finishes. Wait for that cleanup instead of deleting live
      // browser profile files immediately after the frontend exit event.
      let cleaned = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const workspaces = (await readdir(dir)).filter(name => name.startsWith('exec-'));
        const temporaryExists = await Promise.all(workspaces.map(async name => {
          try { await stat(path.join(dir, name, 'tmp')); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
        }));
        if (!temporaryExists.some(Boolean)) { cleaned = true; break; }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const receipts = await Promise.all((await readdir(dir)).filter(name => name.startsWith('exec-')).map(async name => { try { return JSON.parse(await readFile(path.join(dir, name, 'cleanup-diagnostic.json'), 'utf8')); } catch { return { receipt: 'unavailable' }; } }));
      assert.equal(cleaned, true, 'Temporary cleanup incomplete: ' + JSON.stringify(receipts));
    } finally {
      clearTimeout(timer); child.kill('SIGKILL'); lines.close();
      fixture.closeAllConnections(); fixture.close();
      await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });
}
