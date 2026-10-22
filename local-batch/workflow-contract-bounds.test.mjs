import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import { workflowInputSchema } from './workflow-contract.mjs';
import { validateWorkflow } from './runner.mjs';
const validateSchema = new AjvJsonSchemaValidator().getValidator(workflowInputSchema);
const wrap = step => ({ steps: [step] });
const positive = [
  { type: 'goto', url: 'x' }, { type: 'goto', url: 'x'.repeat(2000) },
  { type: 'fill', selector: '#x', value: '' }, { type: 'fill', selector: '#x', value: 'x'.repeat(10000) },
  { type: 'press', selector: '#x', key: 'x' }, { type: 'press', selector: '#x', key: 'x'.repeat(100) },
  { type: 'assertText', selector: '#x', contains: 'x' }, { type: 'assertText', selector: '#x', contains: 'x'.repeat(2000) },
  { type: 'assertText', selector: '#x', equals: '' }, { type: 'assertText', selector: '#x', equals: 'x'.repeat(2000) },
  { type: 'scroll', deltaX: -10000, deltaY: -10000 }, { type: 'scroll', deltaX: 10000, deltaY: 10000 },
];
const invalid = [
  ['url-empty', { type: 'goto', url: '' }], ['url-long', { type: 'goto', url: 'x'.repeat(2001) }],
  ['fill-long', { type: 'fill', selector: '#x', value: 'x'.repeat(10001) }],
  ['key-empty', { type: 'press', selector: '#x', key: '' }], ['key-long', { type: 'press', selector: '#x', key: 'x'.repeat(101) }],
  ['contains-empty', { type: 'assertText', selector: '#x', contains: '' }], ['contains-long', { type: 'assertText', selector: '#x', contains: 'x'.repeat(2001) }],
  ['equals-long', { type: 'assertText', selector: '#x', equals: 'x'.repeat(2001) }],
  ...['deltaX', 'deltaY'].flatMap(key => [-10001, 10001].map(value => [key + '-' + value, { type: 'scroll', [key]: value }])),
];

test('SDK schema and runtime admit existing ASCII string and scroll boundary documents', () => {
  for (const step of positive) {
    assert.doesNotThrow(() => validateWorkflow(wrap(step)));
    assert.equal(validateSchema(wrap(step)).valid, true, 'Existing runtime-valid boundary must remain discoverable');
  }
});
test('SDK schema rejects out-of-bound documents already rejected before runtime allocation', () => {
  for (const [, step] of invalid) assert.throws(() => validateWorkflow(wrap(step)));
  const admitted = invalid.filter(([, step]) => validateSchema(wrap(step)).valid).map(([name]) => name);
  assert.deepEqual(admitted, [], 'Advertised bounds must not admit these runtime-invalid documents');
});
test('metadata bounds retain refusal of caller-controlled execution/security fields', () => {
  for (const key of ['force', 'signal', 'code', 'timeoutMs', 'allowMutations', 'workerModule']) {
    const spec = wrap({ type: 'click', selector: '#x', [key]: true });
    assert.throws(() => validateWorkflow(spec)); assert.equal(validateSchema(spec).valid, false);
  }
});
