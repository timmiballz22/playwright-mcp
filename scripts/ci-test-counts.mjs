// Count completed test summaries from GitHub's job<TAB>step<TAB>timestamp log.
// Job conclusions and installation failures are separate evidence, not test counts.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
// Checkpoint only receipt numbers, never pass counts, payloads or cleanup claims.
// Keep notices useful even when a cancelled job's eventual log is unavailable.
export function createBatchCheckpoints() {
  let completed = 0, notices = 0, finished = false;
  return line => {
    if (typeof line !== 'string' || finished || notices >= 16) return '';
    line = line.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
    if (/^(?:#|ℹ) tests \d+$/.test(line) || line === '✖ failing tests:') { finished = true; return ''; }
    const tap = line.match(/^(?:not )?ok ([1-9]\d{0,5}) - /);
    if (tap) {
      const index = Number(tap[1]);
      if (index <= completed || index > 100000) return '';
      completed = index;
    } else if (/^[✔✖] /.test(line)) completed++;
    else return '';
    if (completed % 25 || completed > 100000) return '';
    notices++;
    return '::notice title=Batch test progress::completedTestNumber=' + completed + '\n';
  };
}

export function countCITests(log) {
  const groups = new Map();
  for (const line of log.split(/\r?\n/)) {
    const [job, step, ...tail] = line.split('\t');
    if (!tail.length) continue;
    const body = tail.join('\t').replace(/^\S+Z\s*/, '').trim();
    let match = body.match(/^(?:#|ℹ) (tests|pass|fail|skipped|cancelled) (\d+)$/);
    if (!match) {
      const original = body.match(/^(\d+) (passed|failed|skipped|interrupted)(?:\s|$)/);
      if (original) match = [original[0], { passed: 'pass', failed: 'fail', skipped: 'skipped', interrupted: 'cancelled' }[original[2]], original[1]];
    }
    if (!match) continue;
    const key = JSON.stringify([job, step]);
    const row = groups.get(key) ?? { job, step, pass: 0, fail: 0, skipped: 0, cancelled: 0 };
    row[match[1]] = Number(match[2]); groups.set(key, row);
  }
  const totals = { pass: 0, fail: 0, skipped: 0, cancelled: 0 };
  for (const group of groups.values()) {
    if (group.tests !== undefined && group.tests !== group.pass + group.fail + group.skipped + group.cancelled)
      throw new Error('inconsistent_test_summary');
    for (const key of Object.keys(totals)) totals[key] += group[key];
  }
  return { ...totals, groups: [...groups.values()] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const filename of process.argv.slice(2)) console.log(JSON.stringify({ filename, ...countCITests(await readFile(filename, 'utf8')) }));
}
