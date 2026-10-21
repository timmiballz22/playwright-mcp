// Optional local operator benchmark. Zero model turns; owned static fixture only.
// Counts JSON tool parameters/results, NOT wire envelopes or model tokens.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, readFile, realpath, stat, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { ownedDescendants } from '../local-batch/fixtures/process-audit.mjs';
const repository = fileURLToPath(new URL('../', import.meta.url));
const directory = await mkdtemp(path.join(os.tmpdir(), 'interface-benchmark-'));
const fixture = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end('<!doctype html><title>Owned counter</title><button>Add</button><output aria-live="polite">0</output><script>let n=0;document.querySelector("button").onclick=()=>document.querySelector("output").textContent=String(++n)</script>');
});
fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
const origin = `http://127.0.0.1:${fixture.address().port}`;
const workflow = { timeoutMs: 120000, steps: [{ type: 'goto', url: origin },
  { type: 'click', selector: { role: 'button', name: 'Add' }, repeat: 100 },
  { type: 'assertText', selector: 'output', equals: '100' }, { type: 'assertURL', url: origin + '/' }] };
const bytes = value => Buffer.byteLength(JSON.stringify(value));
const playwrightVersion = createRequire(import.meta.url)('playwright/package.json').version;
const results = []; let verified = false;
async function stopped(roots) {
  const end = performance.now() + 10000;
  while ((await ownedDescendants(roots)).length && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 100));
  assert.deepEqual(await ownedDescendants(roots), [], 'Benchmark owned cleanup is uncertain');
}
try {
  for (const mode of ['original_mcp', 'batch_mcp']) {
    const client = new Client({ name: 'interface-benchmark', version: '1.0.0' });
    const transport = new StdioClientTransport({ command: process.execPath,
      args: mode === 'original_mcp' ? [path.join(repository, 'cli.js'), '--browser=chromium', '--headless', '--isolated'] : [path.join(repository, 'local-batch/mcp.mjs')],
      cwd: directory, stderr: 'pipe', env: { ...process.env, PLAYWRIGHT_BATCH_ALLOWED_ORIGINS: origin, PLAYWRIGHT_BATCH_ARTIFACTS_DIR: path.join(directory, 'artifacts') },
    });
    transport.stderr.resume();
    const start = performance.now(); let measurement; let root; let observed = []; let toolCalls = 0; let parameterBytes = 0; let resultBytes = 0; let snapshotFileBytes = 0; let snapshotFilesRead = 0;
    try {
      await client.connect(transport, { timeout: 20000 }); root = transport.pid;
      assert.ok(Number.isSafeInteger(root)); observed = await ownedDescendants([root], { rememberLiveRoots: true });
      const inventory = await client.listTools(); const setupMs = Math.round(performance.now() - start);
      const call = async (name, args) => {
        const params = { name, arguments: args }; toolCalls++; parameterBytes += bytes(params);
        const result = await client.callTool(params, undefined, { timeout: 120000 }); resultBytes += bytes(result);
        assert.notEqual(result.isError, true, 'Benchmark tool failed (' + name + '): ' + JSON.stringify(result).slice(-3000)); return result;
      };
      const snapshotText = async result => {
        const text = result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
        const link = text.match(/\[Snapshot\]\(([^)]+)\)/)?.[1];
        if (!link) return text;
        const filename = await realpath(path.resolve(directory, link));
        const relative = path.relative(directory, filename);
        assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
        const metadata = await stat(filename); assert.ok(metadata.isFile() && metadata.size <= 1048576);
        const content = await readFile(filename, 'utf8'); snapshotFileBytes += Buffer.byteLength(content); snapshotFilesRead++;
        return text + '\n' + content;
      };
      if (mode === 'original_mcp') {
        const navigation = await call('browser_navigate', { url: origin });
        const text = await snapshotText(navigation);
        const ref = text.match(/button "Add" \[ref=([^\]]+)\]/)?.[1]; assert.ok(ref, 'Owned button reference unavailable: ' + text.slice(-3000));
        for (let click = 0; click < 100; click++) await call('browser_click', { element: 'Add', target: ref });
        const snapshot = await call('browser_snapshot', {});
        const final = await snapshotText(snapshot);
        assert.match(final, /- (?:status|generic)(?:\s+\[[^\]]+\])*:\s*(?:"100"|100)\s*$/m); assert.ok(final.includes(origin));
      } else {
        const result = JSON.parse((await call('browser_run_batch', workflow)).content[0].text);
        assert.equal(result.ok, true); assert.equal(result.completed, 103);
      }
      observed.push(...await ownedDescendants([root], { rememberLiveRoots: true }));
      measurement = { mode, clicks: 100, toolCalls, parameterBytes, resultBytes, snapshotFilesRead, snapshotFileBytes, discoveryJsonBytes: bytes(inventory), setupMs,
        totalMs: Math.round(performance.now() - start), routing: mode === 'batch_mcp' ? 'strict_origins_fetch' : 'upstream_default' };
    } finally {
      try { if (root && transport.pid === root) observed.push(...await ownedDescendants([root], { rememberLiveRoots: true })); }
      finally { await client.close(); }
      if (root) await stopped([root, ...observed]);
    }
    measurement.totalWithAuditedShutdownMs = Math.round(performance.now() - start); results.push(measurement);
  }
  const workflowPath = path.join(directory, 'workflow.json'); await writeFile(workflowPath, JSON.stringify(workflow), { mode: 0o600, flag: 'wx' });
  const start = performance.now(); let child;
  const completion = new Promise((resolve, reject) => {
    child = execFile(process.execPath, [path.join(repository, 'local-batch/cli.mjs'), '--workflow', workflowPath, '--allow-origin', origin, '--artifacts', path.join(directory, 'cli-artifacts')],
      { cwd: directory, timeout: 120000, maxBuffer: 65536 }, (error, stdout) => error ? reject(new Error('Benchmark CLI failed')) : resolve(stdout));
  });
  completion.catch(() => {});
  let observed = []; let cliMeasurement;
  try {
    observed = await ownedDescendants([child.pid], { rememberLiveRoots: true });
    const output = await completion; const result = JSON.parse(output);
    assert.equal(result.ok, true); assert.equal(result.completed, 103);
    cliMeasurement = { mode: 'fork_batch_cli', clicks: 100, toolCalls: 0, workflowJsonBytes: bytes(workflow), stdoutBytes: Buffer.byteLength(output), totalMs: Math.round(performance.now() - start), routing: 'strict_origins_fetch' };
  } finally { await completion.catch(() => {}); await stopped([child.pid, ...observed]); }
  cliMeasurement.totalWithAuditedShutdownMs = Math.round(performance.now() - start); results.push(cliMeasurement);
  verified = true;
} finally {
  fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
  if (verified) await rm(directory, { recursive: true, force: true });
}
console.log(JSON.stringify({ os: process.platform, architecture: process.arch, node: process.version, playwright: playwrightVersion, samples: 1, modelTurns: 0,
  tokens: 'not_measured', resources: 'not_measured', jsonEnvelopeBytesIncluded: false, officialCliSkills: 'not_measured', results, activeOwnedProcesses: 0 }));
