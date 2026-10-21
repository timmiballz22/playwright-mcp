// Copyright 2026 contributors. Apache-2.0 license.
import { mkdir, open, link, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Return bounded MCP output; retain complete redacted step results on local disk.
export async function saveReport(result, artifactsDir) {
  const encoded = JSON.stringify(result, null, 2) + '\n';
  if (Buffer.byteLength(encoded) > 8 * 1024 * 1024)
    throw Object.assign(new Error('Report exceeds byte limit'), { code: 'REPORT_BYTE_LIMIT' });
  await mkdir(artifactsDir, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  const reportPath = path.join(artifactsDir, 'run-' + id + '.json');
  const temporary = path.join(artifactsDir, '.run-' + id + '.tmp');
  let created = false;
  try {
    const file = await open(temporary, 'wx', 0o600); created = true;
    try { await file.writeFile(encoded); }
    finally { await file.close(); }
    // Publish atomically without replacing a target that appeared during I/O.
    await link(temporary, reportPath);
  } finally {
    if (created) await rm(temporary, { force: true });
  }
  const { results, ...summary } = result;
  return {
    ...summary,
    reportPath,
    recentSteps: results.slice(-10),
    failedStep: results.find(r => !r.ok) ?? null,
  };
}
