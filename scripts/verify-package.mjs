import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const root = process.cwd();
const dir = await mkdtemp(path.join(os.tmpdir(), 'fork-install-'));
const npm = (args, cwd) => execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
try {
  const [packed] = JSON.parse(npm(['pack', '--pack-destination', dir, '--json'], root));
  for (const required of ['local-batch/mcp.mjs', 'local-batch/runner.mjs', 'local-batch/cli.mjs', 'scripts/bootstrap-local-batch.ps1', 'scripts/bootstrap-local-batch.sh']) {
    if (!packed.files.some(f => f.path === required)) throw new Error(`Missing distribution entry: ${required}`);
  }
  await writeFile(path.join(dir, 'package.json'), '{"private":true}\n');
  npm(['install', '--omit=dev', '--ignore-scripts', path.join(dir, packed.filename)], dir);
  const target = path.join(dir, 'node_modules/@timmiballz22/playwright-mcp-local');
  process.stdout.write(execFileSync(process.execPath, ['scripts/production-smoke.mjs', target], { cwd: root, encoding: 'utf8' }));
  console.log(JSON.stringify({ tarball: packed.filename, integrity: packed.integrity, fileCount: packed.files.length, production: true }));
} finally { await rm(dir, { recursive: true, force: true }); }
