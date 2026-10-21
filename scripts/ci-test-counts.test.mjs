import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countCITests } from './ci-test-counts.mjs';
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
