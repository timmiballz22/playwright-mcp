import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createBatchCheckpoints, countCITests } from '/workspace/playwright-mcp/scripts/ci-test-counts.mjs';
const jobs = JSON.parse(await fs.readFile('/tmp/native88-39788239513-rest-jobs.json', 'utf8')).jobs;
const results = [];
for (const name of ['batch (ubuntu-latest, 20)', 'batch (ubuntu-latest, 24)', 'batch (windows-latest, 22)']) {
  const job = jobs.find(job => job.name === name);
  const log = await fs.readFile('/tmp/native88-batch-job-' + job.id + '.log', 'utf8');
  const checkpoint = createBatchCheckpoints(); let added = '', markers = [];
  for (const line of log.split('\n')) {
    const [jobName, step, ...tail] = line.split('\t');
    if (!step?.startsWith('Run mock and real browser tests through')) continue;
    const body = tail.join('\t').replace(/^\S+Z\s*/, '');
    const marker = checkpoint(body);
    if (marker) { markers.push(marker); added += jobName + '\t' + step + '\t2026-10-22T00:00:00.000Z ' + marker; }
  }
  assert.equal(markers.length, 8);
  assert.equal(markers[0], '::notice title=Batch test progress::completedTestNumber=25\n');
  assert.equal(markers.at(-1), '::notice title=Batch test progress::completedTestNumber=200\n');
  assert.deepEqual(countCITests(log + added), countCITests(log));
  results.push({ job: name, noticeCount: markers.length, firstReceipt: 25, lastReceipt: 200, completedSummaryCountsUnchanged: true });
}
console.log(JSON.stringify({ phase: 'Local replay excluded from native89; not a fresh browser/CI run', results }));
