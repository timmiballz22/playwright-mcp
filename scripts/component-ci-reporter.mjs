// A second Node reporter for early, fixed-field CI failure locations. TAP remains
// authoritative for counts. Never emit test names, errors, payloads or paths
// outside the explicit component source set.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repository = fileURLToPath(new URL('../', import.meta.url));
const files = new Set([
  ...['journal', 'journal-stop', 'temporary-cleanup-stop', 'launch-ownership', 'http-early-metadata', 'artifact-cleanup-receipt', 'retained-artifact-budget', 'guardian', 'guardian-stop', 'guardian-diagnostic',
    'workflow-snapshot', 'controller', 'controller-open', 'contention', 'config',
    'private-windows', 'artifact-cleanup', 'artifact-cleanup-supervisor', 'retention',
    'maintenance', 'queue-clock', 'component-ci-reporter'].map(name => `local-batch/jobs/${name}.test.mjs`),
  'scripts/ci-test-counts.test.mjs', 'local-batch/cleanup.test.mjs',
]);
export function componentFailureAnnotation(event) {
  if (event?.type !== 'test:fail') return '';
  const data = event.data ?? {};
  const relative = typeof data.file === 'string' ? path.relative(repository, path.resolve(data.file)).split(path.sep).join('/') : '';
  let location = '';
  if (files.has(relative)) {
    location = ',file=' + relative;
    if (Number.isSafeInteger(data.line) && data.line > 0 && data.line <= 1000000) location += ',line=' + data.line;
  }
  const index = Number.isSafeInteger(data.testNumber) && data.testNumber > 0 && data.testNumber <= 100000
    ? 'testNumber=' + data.testNumber : 'testNumber=unknown';
  return '::error title=Durable component test did not pass' + location + '::' + index + '\n';
}
export default async function* report(events) {
  for await (const event of events)
    if (process.env.GITHUB_ACTIONS === 'true') yield componentFailureAnnotation(event);
}
