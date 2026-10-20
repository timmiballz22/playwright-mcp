// Copyright 2026 contributors. Apache-2.0 license.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Return bounded MCP output; retain complete redacted step results on local disk.
export async function saveReport(result, artifactsDir) {
  await mkdir(artifactsDir, { recursive: true, mode: 0o700 });
  const reportPath = path.join(artifactsDir, 'run-' + randomUUID() + '.json');
  await writeFile(reportPath, JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  const { results, ...summary } = result;
  return {
    ...summary,
    reportPath,
    recentSteps: results.slice(-10),
    failedStep: results.find(r => !r.ok) ?? null,
  };
}
