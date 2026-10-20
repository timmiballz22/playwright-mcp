// Explicit file expansion works on Windows PowerShell and Node 20.
import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = (await readdir(new URL('../local-batch/', import.meta.url)))
  .filter(file => file.endsWith('.test.mjs')).sort().map(file => `local-batch/${file}`);
// CPU-stall fault fixtures must not compete with interactive browser fixtures.
const concurrency = 1;
const child = spawn(process.execPath, ['--test', '--test-concurrency=' + concurrency, ...files], {
  cwd: root, stdio: ['inherit', 'pipe', 'inherit'], env: { ...process.env, RUN_BROWSER_TESTS: '1' },
});
const decoder = new StringDecoder('utf8');
let pending = '';
const annotated = new Set();
const emit = line => {
  process.stdout.write(line + '\n');
  if (process.env.GITHUB_ACTIONS === 'true') {
    // Only static test names and fixed-field cleanup receipts become annotations.
    // Never annotate arbitrary browser messages or workflow input.
    const receipt = line.match(/(?:Temporary cleanup incomplete:|Missing expected rejection:) (\[?\{\"receipt\":\"unavailable\"\}\]?)/);
    const failure = /^(?:not ok \d+ - |✖ (?!failing tests:))/.test(line) ? line.slice(0, 300) : receipt?.[0];
    if (failure && !annotated.has(failure)) {
      annotated.add(failure);
      const escaped = failure.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
      process.stdout.write('::error title=Batch acceptance failure::' + escaped + '\n');
    }
  }
};
child.stdout.on('data', chunk => {
  pending += decoder.write(chunk);
  let boundary;
  while ((boundary = pending.indexOf('\n')) !== -1) {
    emit(pending.slice(0, boundary).replace(/\r$/, ''));
    pending = pending.slice(boundary + 1);
  }
});
child.stdout.on('end', () => { pending += decoder.end(); if (pending) emit(pending); });
child.on('error', () => { process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; });
