// Copyright 2026 contributors. Apache-2.0 license.
import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Return bounded MCP output; retain complete redacted step results on local disk.
export async function saveReport(result, artifactsDir) {
  await mkdir(artifactsDir, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  const reportPath = path.join(artifactsDir, 'run-' + id + '.json');
  const temporary = path.join(artifactsDir, '.run-' + id + '.tmp');
  try {
    await writeFile(temporary, JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temporary, reportPath);
  } finally {
    await rm(temporary, { force: true });
  }
  const { results, ...summary } = result;
  return {
    ...summary,
    reportPath,
    recentSteps: results.slice(-10),
    failedStep: results.find(r => !r.ok) ?? null,
  };
}
