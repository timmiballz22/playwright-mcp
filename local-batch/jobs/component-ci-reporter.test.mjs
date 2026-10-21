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
