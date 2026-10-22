import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { componentFailureAnnotation, default as report } from '../../scripts/component-ci-reporter.mjs';

test('component CI annotations retain only known source location and numeric test index', () => {
  const value = componentFailureAnnotation({ type: 'test:fail', data: {
    file: fileURLToPath(new URL('./journal.test.mjs', import.meta.url)), line: 12, testNumber: 3,
    name: 'private-ci-canary', details: { error: new Error('private-ci-canary') },
  } });
  assert.equal(value, '::error title=Durable component test did not pass,file=local-batch/jobs/journal.test.mjs,line=12::testNumber=3\n');
});
test('unknown CI paths, malformed fields and error text cannot enter annotations', () => {
  for (const file of ['/outside/private-ci-canary', fileURLToPath(new URL('./private-ci-canary.test.mjs', import.meta.url)), undefined]) {
    const value = componentFailureAnnotation({ type: 'test:fail', data: {
      file, line: 'private-ci-canary', testNumber: 'private-ci-canary', name: 'private-ci-canary', details: { error: 'private-ci-canary' },
    } });
    assert.equal(value, '::error title=Durable component test did not pass::testNumber=unknown\n');
  }
  assert.equal(componentFailureAnnotation({ type: 'test:pass', data: {} }), '');
  assert.equal(componentFailureAnnotation(null), '');
});
test('component annotation reporter stays silent outside explicit GitHub Actions mode', async () => {
  const previous = process.env.GITHUB_ACTIONS; delete process.env.GITHUB_ACTIONS;
  try {
    const output = [];
    for await (const value of report([{ type: 'test:fail', data: {} }])) output.push(value);
    assert.deepEqual(output, []);
  } finally {
    if (previous === undefined) delete process.env.GITHUB_ACTIONS; else process.env.GITHUB_ACTIONS = previous;
  }
});

test('component annotations classify bounded Node failure metadata without error payloads', () => {
  for (const [error, failureClass] of [
    [{ code: 'ERR_TEST_FAILURE', failureType: 'testCodeFailure', cause: { code: 'ERR_ASSERTION' } }, 'assertion'],
    [{ code: 'ERR_TEST_FAILURE', failureType: 'testCodeFailure', cause: { code: 'ENOENT' } }, 'missing_path'],
    [{ code: 'ERR_TEST_FAILURE', failureType: 'testTimeoutFailure' }, 'timeout'],
    [{ code: 'ERR_TEST_FAILURE', failureType: 'cancelledByParent' }, 'cancelled'],
    [{ code: 'ERR_TEST_FAILURE', cause: { code: 'journal_busy' } }, 'journal_busy'],
    [{ code: 'ERR_TEST_FAILURE', cause: { code: 'EPERM' } }, 'permission'],
  ]) {
    error.message = 'private-ci-canary';
    const value = componentFailureAnnotation({ type: 'test:fail', data: { testNumber: 7, details: { error, duration_ms: 123.9 } } });
    assert.equal(value, `::error title=Durable component test did not pass::testNumber=7 failureClass=${failureClass} durationMs=123\n`);
    assert.equal(value.includes('private-ci-canary'), false);
  }
});

test('component failure metadata ignores unknown codes and invalid durations with bounded traversal', () => {
  const error = { code: 'private-ci-canary', failureType: 'private-ci-canary' }; error.cause = error;
  for (const duration_ms of [-1, NaN, Infinity, 1800001, 'private-ci-canary']) {
    const value = componentFailureAnnotation({ type: 'test:fail', data: { testNumber: 2, details: { error, duration_ms } } });
    assert.equal(value, '::error title=Durable component test did not pass::testNumber=2\n');
  }
});

test('component classification never invokes error getters and stops before deep causes', () => {
  let invoked = 0;
  const error = {};
  for (const key of ['code', 'cause', 'failureType']) Object.defineProperty(error, key, { get() { invoked++; throw new Error('private-ci-canary'); } });
  const annotation = value => componentFailureAnnotation({ type: 'test:fail', data: { testNumber: 2, details: { error: value } } });
  assert.equal(annotation(error), '::error title=Durable component test did not pass::testNumber=2\n');
  assert.equal(invoked, 0);
  assert.equal(annotation({ cause: { cause: { cause: { code: 'ERR_ASSERTION' } } } }), '::error title=Durable component test did not pass::testNumber=2\n');
  assert.equal(annotation(new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('private-ci-canary'); } })), '::error title=Durable component test did not pass::testNumber=2\n');
});
