import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureWorkflow } from './workflow-snapshot.mjs';

test('workflow identity ignores object key order, defaults and equivalent repeat expansion', () => {
  const one = captureWorkflow({ steps: [{ type: 'click', selector: { role: 'button', name: 'Save' }, repeat: 2 }] });
  const two = captureWorkflow({ browser: 'chromium', schemaVersion: 1, iterations: 1, timeoutMs: 120000, actionTimeoutMs: 5000,
    steps: [{ selector: { name: 'Save', role: 'button' }, type: 'click' }, { type: 'click', selector: { role: 'button', name: 'Save' } }] });
  assert.equal(one.digest, two.digest);
  assert.notEqual(one.digest, captureWorkflow({ steps: [{ type: 'click', selector: 'different' }] }).digest);
});

test('captured workflow input cannot change after submission and oversized or unknown data is rejected', () => {
  const input = { steps: [{ type: 'fill', selector: { label: 'Name' }, value: 'fixture' }] };
  const captured = captureWorkflow(input);
  input.steps[0].value = 'changed'; input.steps[0].selector.label = 'Different';
  assert.equal(captured.workflow.steps[0].value, 'fixture');
  assert.equal(captured.workflow.steps[0].selector.label, 'Name');
  assert.throws(() => captureWorkflow({ steps: input.steps, workerModule: 'untrusted' }));
  assert.throws(() => captureWorkflow({ steps: input.steps, secret: 'x'.repeat(1048576) }));
});
