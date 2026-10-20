import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

async function running(pid) {
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux' && /\) Z /.test(await readFile(`/proc/${pid}/stat`, 'utf8'))) return false;
    return true;
  } catch { return false; }
}

test('abrupt execution-host death terminates its supervisor, worker and real browser', { timeout: 20000 }, async () => {
  let sawRequest;
  const requested = new Promise(resolve => { sawRequest = resolve; });
  const fixture = createServer(() => sawRequest()); // intentionally never respond
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  const dir = await mkdtemp(path.join(os.tmpdir(), 'parent-death-'));
  const child = spawn(process.execPath, [fileURLToPath(new URL('./fixtures/executor-parent.mjs', import.meta.url)), origin, dir], { stdio: ['ignore', 'pipe', 'ignore'] });
  const exited = once(child, 'exit');
  const pids = [];
  let sawBrowser;
  const browserReady = new Promise(resolve => { sawBrowser = resolve; });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    const event = JSON.parse(line);
    if (event.pid) pids.push(event.pid);
    if (event.type === 'ownedProcess') sawBrowser();
  });
  let startupTimer;
  try {
    await Promise.race([Promise.all([requested, browserReady]), new Promise((_, reject) => { startupTimer = setTimeout(() => reject(new Error('Real browser startup failed')), 10000); })]);
    clearTimeout(startupTimer);
    child.kill('SIGKILL'); await exited;
    assert.equal(pids.length, 3, 'Expected supervisor, worker and real browser ownership');
    for (let attempt = 0; attempt < 100; attempt++) {
      if (!(await Promise.all(pids.map(running))).some(Boolean)) {
        const workspaces = (await readdir(dir)).filter(name => name.startsWith('exec-'));
        assert.equal(workspaces.length, 1);
        let receipt;
        try { receipt = JSON.parse(await readFile(path.join(dir, workspaces[0], 'cleanup-diagnostic.json'), 'utf8')); } catch { receipt = { receipt: 'unavailable' }; }
        await assert.rejects(stat(path.join(dir, workspaces[0], 'tmp')), { code: 'ENOENT' }, JSON.stringify(receipt));
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.fail('A process owned by the dead execution host is still running');
  } finally {
    clearTimeout(startupTimer); child.kill('SIGKILL'); lines.close();
    fixture.closeAllConnections(); fixture.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
