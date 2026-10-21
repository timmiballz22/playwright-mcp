// Fresh simultaneous SDK startup control after an actual Codex failure.
// No browser action, global config change, client restart or warmed Codex store.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { windowsHelperFailureKind } from '../local-batch/jobs/private-windows.mjs';
import { ownedDescendants } from '../local-batch/fixtures/process-audit.mjs';
const entry = fileURLToPath(new URL('../local-batch/jobs-mcp.mjs', import.meta.url));
const expected = ['start_workflow', 'get_workflow_status', 'get_workflow_result', 'cancel_workflow', 'list_workflows', 'cleanup_workflows'].sort();
// Pinned Codex0.163.0 WINDOWS_CORE_ENV_VARS, not a widened client environment.
const coreNames = new Set(['PATH', 'PATHEXT', 'SHELL', 'COMSPEC', 'SYSTEMROOT', 'WINDIR', 'SYSTEMDRIVE', 'USERNAME', 'USERDOMAIN', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMW6432', 'PROGRAMDATA', 'LOCALAPPDATA', 'APPDATA', 'TEMP', 'TMP', 'TMPDIR', 'POWERSHELL', 'PWSH']);
const coreEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => coreNames.has(name.toUpperCase())));
for (const mode of process.platform === 'win32' ? ['inherited', 'codex_core'] : ['inherited']) for (let iteration = 1; iteration <= 3; iteration++) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sdk-jobs-startup-'));
  const clients = []; const transports = []; const recordedRoots = []; const startupCodes = new Set();
  let observed = []; let verified = false; const started = performance.now();
  try {
    const outcomes = await Promise.allSettled([0, 1].map(async index => {
      const client = new Client({ name: 'simultaneous-startup-control', version: '1.0.0' }); clients.push(client);
      const transport = new StdioClientTransport({ command: process.execPath, args: [entry], cwd: directory, stderr: 'pipe', env: {
        ...(mode === 'codex_core' ? coreEnv : process.env), PLAYWRIGHT_JOBS_OWNER_ID: randomUUID(), PLAYWRIGHT_JOBS_DATA_DIR: path.join(directory, 'state'),
        PLAYWRIGHT_JOBS_PROJECT_DIR: directory, PLAYWRIGHT_JOBS_ALLOWED_ORIGINS: '', PLAYWRIGHT_JOBS_ALLOW_MUTATIONS: '0', PLAYWRIGHT_JOBS_ALLOW_SENSITIVE_ARTIFACTS: '0',
      } });
      transports.push(transport); let tail = '';
      // pid is cleared when an SDK transport exits. Retain and identify the live
      // child before initialize can fail, so failed startups cannot hide orphans.
      const startTransport = transport.start.bind(transport);
      transport.start = async () => {
        await startTransport();
        assert.ok(Number.isSafeInteger(transport.pid), 'SDK process identity unavailable');
        recordedRoots.push(transport.pid);
        observed.push(...await ownedDescendants([transport.pid], { rememberLiveRoots: true }));
      };
      transport.stderr.on('data', chunk => {
        tail = (tail + chunk.toString()).slice(-4096);
        for (const match of tail.matchAll(/Local jobs startup failed \(([a-z_]{1,40})\)/g)) startupCodes.add(match[1]);
      });
      await client.connect(transport, { timeout: 20000 });
      const tools = (await client.listTools({}, { timeout: 5000 })).tools.map(tool => tool.name).sort();
      assert.deepEqual(tools, expected);
      const empty = await client.callTool({ name: 'list_workflows', arguments: { limit: 1 } }, undefined, { timeout: 5000 });
      assert.notEqual(empty.isError, true); assert.deepEqual(JSON.parse(empty.content[0].text).jobs, []);
      return { index, tools: tools.length };
    }));
    const receipt = { os: process.platform, mode, iteration, clients: 2, connected: outcomes.filter(item => item.status === 'fulfilled').length,
      durationMs: Math.round(performance.now() - started), startupCodes: [...startupCodes].sort(), browserActions: 0 };
    console.log(JSON.stringify(receipt));
    if (process.env.GITHUB_ACTIONS === 'true') console.error('::notice title=SDK startup control::' + JSON.stringify(receipt));
    if (process.platform === 'win32' && iteration === 1) {
      const script = await readFile(new URL('../local-batch/jobs/private-windows.ps1', import.meta.url), 'utf8');
      const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      // Instrument only this owned diagnostic copy, never the production helper.
      const traced = script.replace("$ErrorActionPreference = 'Stop'", "$ErrorActionPreference = 'Stop';[Console]::Error.WriteLine('helper_phase:entered')")
        .replace('$base = Ensure-PrivateDirectory', "[Console]::Error.WriteLine('helper_phase:storage');$base = Ensure-PrivateDirectory")
        .replace('$project = Ensure-PrivateDirectory', "[Console]::Error.WriteLine('helper_phase:base_ready');$project = Ensure-PrivateDirectory")
        .replace('[Console]::WriteLine((@{ok=$true;', "[Console]::Error.WriteLine('helper_phase:serialization');[Console]::WriteLine((@{ok=$true;");
      const phasesOf = value => [...new Set([...String(value ?? '').matchAll(/helper_phase:(entered|storage|base_ready|serialization)/g)].map(match => match[1]))];
      for (const variant of mode === 'codex_core' ? ['unchanged', 'system_modules'] : ['unchanged']) {
        let helper;
        try {
          const result = await promisify(execFile)(executable, ['-NoProfile', '-NonInteractive', '-Command', traced], { timeout: 10000, maxBuffer: 65536, windowsHide: true, env: {
            ...(mode === 'codex_core' ? coreEnv : process.env),
            ...(variant === 'system_modules' ? { PSModulePath: path.join(path.dirname(executable), 'Modules') } : {}),
            PLAYWRIGHT_PRIVATE_BASE: path.join(directory, 'helper-control-' + variant),
            PLAYWRIGHT_PRIVATE_PROJECT: directory, PLAYWRIGHT_PRIVATE_OWNER_HASH: createHash('sha256').update(randomUUID()).digest('hex'),
          } });
          let valid = false; try { valid = JSON.parse(result.stdout).ok === true; } catch {}
          helper = { kind: valid ? 'success' : 'invalid_output', phases: phasesOf(result.stderr) };
        } catch (error) {
          const kind = windowsHelperFailureKind(error);
          helper = { kind, phases: phasesOf(error.stderr), ...(Number.isInteger(error.code) ? { exitCode: error.code } : {}) };
        }
        console.log(JSON.stringify({ os: process.platform, mode, variant, helper }));
        if (process.env.GITHUB_ACTIONS === 'true') console.error('::notice title=Windows helper control::' + JSON.stringify({ mode, variant, helper }));
      }
    }
    assert.equal(receipt.connected, 2, 'Fresh simultaneous SDK startup failed'); verified = true;
  } finally {
    const roots = [...new Set([...recordedRoots, ...transports.map(transport => transport.pid).filter(Number.isSafeInteger)])];
    try { observed.push(...await ownedDescendants(roots)); }
    finally { await Promise.allSettled(clients.map(client => client.close())); }
    const end = performance.now() + 10000;
    while ((await ownedDescendants([...roots, ...observed])).length && performance.now() < end) await new Promise(resolve => setTimeout(resolve, 100));
    assert.deepEqual(await ownedDescendants([...roots, ...observed]), []);
    console.log(JSON.stringify({ mode, iteration, activeOwnedProcesses: 0 }));
    if (verified) await rm(directory, { recursive: true, force: true });
  }
}
