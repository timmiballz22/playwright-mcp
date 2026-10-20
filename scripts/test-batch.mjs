// Explicit file expansion works on Windows PowerShell and Node 20.
import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = (await readdir(new URL('../local-batch/', import.meta.url)))
  .filter(file => file.endsWith('.test.mjs')).sort().map(file => `local-batch/${file}`);
const child = spawn(process.execPath, ['--test', '--test-concurrency=2', ...files], {
  cwd: root, stdio: 'inherit', env: { ...process.env, RUN_BROWSER_TESTS: '1' },
});
child.on('error', () => { process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; });
