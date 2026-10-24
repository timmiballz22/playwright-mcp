import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countCITests, createBatchCheckpoints } from './ci-test-counts.mjs';
const line = (job, body) => `${job}\tRun tests\t2026-10-21T00:00:00.000Z ${body}`;
test('CI totals include TAP, Node24 spec and original Playwright summaries', () => {
  const log = [line('node22', '# tests 3'), line('node22', '# pass 2'), line('node22', '# fail 1'),
    line('node24', 'ℹ tests 20'), line('node24', 'ℹ pass 20'), line('node24', 'ℹ fail 0'),
    line('original', '  52 passed (33.6s)'), line('original', '2 skipped'),
    line('setup', 'npm package body: # pass 999')].join('\n');
  const { groups, ...totals } = countCITests(log);
  assert.deepEqual(totals, { pass: 74, fail: 1, skipped: 2, cancelled: 0 });
  assert.equal(groups.length, 3);
});
test('a repeated summary is counted once and incomplete Node totals fail closed', () => {
  assert.equal(countCITests([line('one', '# pass 2'), line('one', '# pass 2')].join('\n')).pass, 2);
  assert.throws(() => countCITests(line('one', 'ℹ tests 20')), /inconsistent_test_summary/);
});


test('batch checkpoints expose only bounded TAP receipt indexes without counting them as passes', () => {
  const checkpoint = createBatchCheckpoints();
  assert.equal(checkpoint('    ok 25 - private-checkpoint-canary'), '');
  assert.equal(checkpoint('ok 24 - private-checkpoint-canary'), '');
  assert.equal(checkpoint('not ok 25 - private-checkpoint-canary'), '::notice title=Batch test progress::completedTestNumber=25\n');
  assert.equal(checkpoint('ok 25 - private-checkpoint-canary'), '');
  assert.equal(checkpoint('ok 100001 - private-checkpoint-canary'), '');
  assert.equal(checkpoint('# tests 25'), '');
  assert.equal(checkpoint('ok 50 - private-checkpoint-canary'), '');
});
test('batch spec checkpoints handle colors and stop before repeated failure footer', () => {
  const checkpoint = createBatchCheckpoints();
  let notices = '';
  for (let index = 1; index <= 25; index++) notices += checkpoint('\u001b[32m✔ private-checkpoint-canary\u001b[0m');
  assert.equal(notices, '::notice title=Batch test progress::completedTestNumber=25\n');
  assert.equal(checkpoint('✖ failing tests:'), '');
  for (let index = 0; index < 50; index++) assert.equal(checkpoint('✖ private-checkpoint-canary'), '');
  assert.equal(notices.includes('private-checkpoint-canary'), false);
});
test('batch checkpoint notices have a fixed cap and ignore non-receipt values', () => {
  const checkpoint = createBatchCheckpoints();
  for (const line of [null, {}, '# ok 25 - private-checkpoint-canary', 'private-checkpoint-canary', 'ℹ pass 999']) assert.equal(checkpoint(line), '');
  let notices = '';
  for (let index = 1; index <= 1000; index++) notices += checkpoint('ok ' + index + ' - private-checkpoint-canary');
  assert.equal(notices.split('\n').filter(Boolean).length, 16);
  assert.equal(notices.endsWith('completedTestNumber=400\n'), true);
  assert.equal(notices.includes('private-checkpoint-canary'), false);
});
