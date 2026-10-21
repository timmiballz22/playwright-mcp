import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const root = process.cwd();
const dir = await mkdtemp(path.join(os.tmpdir(), 'fork-install spaces-'));
// Invoke npm's JS entrypoint directly: npm.cmd + shell:true corrupts paths
// containing spaces/metacharacters and is unnecessary on Windows.
const nodeDir = path.dirname(process.execPath);
const candidates = [process.env.npm_execpath,
  path.join(nodeDir, 'node_modules/npm/bin/npm-cli.js'),
  path.join(nodeDir, '../lib/node_modules/npm/bin/npm-cli.js')];
for (const directory of (process.env.PATH || '').split(path.delimiter)) {
  try {
    const resolved = realpathSync(path.join(directory, process.platform === 'win32' ? 'npm.cmd' : 'npm'));
    candidates.push(resolved.endsWith('npm-cli.js') ? resolved : path.join(path.dirname(resolved), 'node_modules/npm/bin/npm-cli.js'));
  } catch {}
}
const npmCli = candidates.find(candidate => candidate && candidate.endsWith('npm-cli.js') && existsSync(candidate));
if (!npmCli) throw new Error('npm CLI not found beside Node or on PATH');
const npm = (args, cwd) => execFileSync(process.execPath, [npmCli, ...args], { cwd, encoding: 'utf8', windowsHide: true });

try {
  const [packed] = JSON.parse(npm(['pack', '--pack-destination', dir, '--json'], root));
  for (const required of ['local-batch/mcp.mjs', 'local-batch/runner.mjs', 'local-batch/cli.mjs', 'local-batch/executor.mjs', 'local-batch/execution-supervisor.mjs', 'local-batch/execution-worker.mjs', 'local-batch/process-tree.mjs', 'local-batch/failure.mjs', 'local-batch/navigation-retry.mjs', 'local-batch/cleanup.mjs', 'local-batch/cleanup-worker.mjs', 'local-batch/workflow-file.mjs', 'local-batch/jobs/journal.mjs', 'local-batch/jobs/journal-worker.mjs', 'local-batch/jobs/journal-protocol.mjs', 'local-batch/jobs/guardian.mjs', 'local-batch/jobs/workflow-snapshot.mjs', 'local-batch/fixtures/guardian-real-owner.mjs', 'scripts/verify-guardian-parent-death.mjs', 'scripts/bootstrap-local-batch.ps1', 'scripts/bootstrap-local-batch.sh']) {
    if (!packed.files.some(f => f.path === required)) throw new Error(`Missing distribution entry: ${required}`);
  }
  await writeFile(path.join(dir, 'package.json'), '{"private":true}\n');
  npm(['install', '--omit=dev', '--ignore-scripts', path.join(dir, packed.filename)], dir);
  const target = path.join(dir, 'node_modules/@timmiballz22/playwright-mcp-local');
  process.stdout.write(execFileSync(process.execPath, ['scripts/production-smoke.mjs', target], { cwd: root, encoding: 'utf8' }));
  process.stdout.write(execFileSync(process.execPath, ['scripts/production-journal-smoke.mjs', target], { cwd: root, encoding: 'utf8' }));
  process.stdout.write(execFileSync(process.execPath, ['scripts/verify-guardian-parent-death.mjs', target], { cwd: root, encoding: 'utf8' }));
  console.log(JSON.stringify({ tarball: packed.filename, integrity: packed.integrity, fileCount: packed.files.length, production: true }));
} finally { await rm(dir, { recursive: true, force: true }); }
