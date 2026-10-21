#!/usr/bin/env node
// Local-only batch CLI; no cloud service, HTTP listener or arbitrary code execution.
import { readWorkflowFile } from './workflow-file.mjs';
import path from 'node:path';
import { executeWorkflow } from './executor.mjs';

function argsOf(argv) {
  const args = { origins: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--workflow')
      args.workflow = argv[++i];
    else if (arg === '--allow-origin')
      args.origins.push(argv[++i]);
    else if (arg === '--navigation-retries') {
      const count = argv[++i];
      if (!/^[0-2]$/.test(count ?? '')) throw new TypeError('navigation-retries must be 0, 1 or 2');
      args.navigationRetry = { maxRetries: Number(count) };
    }
    else if (arg === '--allow-sensitive-artifacts')
      args.allowSensitiveArtifacts = true;
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
  const input = await readWorkflowFile(options.workflow);
  const artifactsDir = path.resolve(options.artifacts ?? '.local-batch-output');
  const abort = new AbortController();
  const cancel = () => abort.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const summary = await executeWorkflow(input, {
      allowedOrigins: options.origins,
      navigationRetry: options.navigationRetry,
      allowSensitiveArtifacts: options.allowSensitiveArtifacts === true,
      artifactsDir,
      signal: abort.signal,
    });
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    if (!summary.ok)
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
