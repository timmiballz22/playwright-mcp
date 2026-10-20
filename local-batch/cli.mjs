#!/usr/bin/env node
// Local-only batch CLI; no cloud service, HTTP listener or arbitrary code execution.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runWorkflow } from './runner.mjs';
import { saveReport } from './report.mjs';

function argsOf(argv) {
  const args = { origins: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--workflow')
      args.workflow = argv[++i];
    else if (arg === '--allow-origin')
      args.origins.push(argv[++i]);
    else if (arg === '--artifacts')
      args.artifacts = argv[++i];
    else
      throw new TypeError('Unknown or incomplete argument: ' + arg);
  }
  if (!args.workflow || typeof args.workflow !== 'string')
    throw new TypeError('Usage: node local-batch/cli.mjs --workflow FILE [--allow-origin ORIGIN] [--artifacts DIR]');
  return args;
}

async function main() {
  const options = argsOf(process.argv.slice(2));
  const input = JSON.parse(await readFile(options.workflow, 'utf8'));
  const artifactsDir = path.resolve(options.artifacts ?? '.local-batch-output');
  const abort = new AbortController();
  const cancel = () => abort.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const result = await runWorkflow(input, {
      allowedOrigins: options.origins,
      artifactsDir,
      signal: abort.signal,
    });
    const summary = await saveReport(result, artifactsDir);
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    if (!result.ok)
      process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

main().catch(error => {
  // Never echo exception messages: URLs and browser errors may contain credentials.
  process.stderr.write('Batch runner failed (' + (error?.name || 'Error') + '). Check local workflow and configuration.\n');
  process.exitCode = 1;
});
