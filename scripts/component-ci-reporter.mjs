// A second Node reporter for early, fixed-field CI failure locations. TAP remains
// authoritative for counts. Never emit test names, errors, payloads or paths
// outside the explicit component source set.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repository = fileURLToPath(new URL('../', import.meta.url));
const files = new Set([
  ...['journal', 'journal-stop', 'temporary-cleanup-stop', 'launch-ownership', 'lifetime-observer', 'http-early-metadata', 'artifact-cleanup-receipt', 'retained-artifact-budget', 'guardian', 'guardian-stop', 'guardian-diagnostic', 'guardian-readiness-diagnostic',
    'workflow-snapshot', 'controller', 'controller-open', 'contention', 'config',
    'private-windows', 'artifact-cleanup', 'artifact-cleanup-supervisor', 'retention',
    'maintenance', 'queue-clock', 'component-ci-reporter'].map(name => `local-batch/jobs/${name}.test.mjs`),
  'scripts/ci-test-counts.test.mjs', 'local-batch/cleanup.test.mjs', 'qa/bounded-stderr.test.mjs',
]);
const failureClasses = new Map([
  ['ERR_ASSERTION', 'assertion'], ['ENOENT', 'missing_path'],
  ['EPERM', 'permission'], ['EACCES', 'permission'],
  ['journal_busy', 'journal_busy'], ['journal_unavailable', 'journal_unavailable'],
  ['rpc_timeout', 'rpc_timeout'],
]);
// Never stringify errors, invoke their getters, or walk an unbounded cause chain.
function ownValue(value, key) {
  if (!value || typeof value !== 'object') return undefined;
  try { return Object.getOwnPropertyDescriptor(value, key)?.value; } catch { return undefined; }
}
function failureClass(error) {
  for (let depth = 0; error && depth < 3; depth++, error = ownValue(error, 'cause')) {
    const kind = ownValue(error, 'failureType');
    if (kind === 'testTimeoutFailure') return 'timeout';
    if (kind === 'cancelledByParent' || kind === 'testAborted') return 'cancelled';
    const known = failureClasses.get(ownValue(error, 'code'));
    if (known) return known;
  }
}
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
  const details = ownValue(data, 'details');
  const kind = failureClass(ownValue(details, 'error'));
  const duration = ownValue(details, 'duration_ms');
  const metadata = (kind ? ' failureClass=' + kind : '') +
    (Number.isFinite(duration) && duration >= 0 && duration <= 1800000 ? ' durationMs=' + Math.floor(duration) : '');
  return '::error title=Durable component test did not pass' + location + '::' + index + metadata + '\n';
}
export default async function* report(events) {
  for await (const event of events)
    if (process.env.GITHUB_ACTIONS === 'true') yield componentFailureAnnotation(event);
}
