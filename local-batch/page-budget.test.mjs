import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePageLimit, validatePageLimit } from './page-budget.mjs';
import { executeWorkflow } from './executor.mjs';
import { validateWorkflow } from './runner.mjs';

test('operator page bounds reject invalid values before worker startup and cannot come from workflow JSON', async () => {
  assert.equal(parsePageLimit(undefined), 8);
  for (const value of ['1', '8', '32']) assert.equal(parsePageLimit(value), Number(value));
  for (const value of ['', '0', '33', '-1', '1.5', '1e1', ' 8', '8 ', 'fake-private-page-canary']) assert.throws(() => parsePageLimit(value), TypeError);
  let events = 0;
  const workflow = { steps: [{ type: 'click', selector: 'button' }] };
  for (const maxPages of [0, 33, -1, 1.5, Infinity, NaN, '8', null]) {
    assert.throws(() => validatePageLimit(maxPages), TypeError);
    await assert.rejects(executeWorkflow(workflow, { maxPages, onEvent: () => events++ }), TypeError);
  }
  assert.equal(events, 0);
  assert.throws(() => validateWorkflow({ ...workflow, maxPages: 32 }), /Unknown property/);
  assert.throws(() => validateWorkflow({ steps: [{ type: 'click', selector: 'button', maxPages: 32 }] }), /Unknown property/);
});
