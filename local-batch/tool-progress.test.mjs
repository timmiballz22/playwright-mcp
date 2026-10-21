import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackToolProgress } from './fixtures/tool-progress.mjs';

test('tool progress preserves receiver, arguments, results and errors while excluding private data', async () => {
  const params = { name: 'browser_cookie_set', arguments: { value: 'private-argument-canary' } };
  const options = { authorization: 'private-option-canary' };
  const result = { content: [{ text: 'private-result-canary' }] };
  const error = new Error('private-exception-canary'); let reject = false;
  const client = { async callTool(...args) { assert.equal(this, client); assert.equal(args[0], params); assert.equal(args[2], options); if (reject) throw error; return result; } };
  const snapshot = trackToolProgress(client, ['browser_cookie_set']);
  assert.equal(await client.callTool(params, undefined, options), result);
  reject = true; await assert.rejects(client.callTool(params, undefined, options), value => value === error);
  const receipt = snapshot(); assert.equal(receipt.calls, 2); assert.equal(receipt.pending, 0);
  assert.deepEqual(receipt.recent.map(item => [item.tool, item.outcome]), [['browser_cookie_set', 'returned'], ['browser_cookie_set', 'rejected']]);
  assert.equal(JSON.stringify(receipt).includes('private-'), false);
});

test('concurrent tool progress stays bounded and unknown names cannot expose canaries', async () => {
  const pending = [];
  const client = { callTool() { return new Promise(resolve => pending.push(resolve)); } };
  const snapshot = trackToolProgress(client, ['browser_evaluate']);
  const calls = Array.from({ length: 6 }, (_, index) => client.callTool({ name: index ? 'browser_evaluate' : 'private-tool-canary', arguments: { value: 'private-argument-canary' } }));
  const active = snapshot(); assert.equal(active.calls, 6); assert.equal(active.pending, 6); assert.equal(active.active.length, 4);
  assert.equal(active.active[0].tool, 'unknown_tool'); assert.equal(JSON.stringify(active).includes('private-'), false);
  assert.ok(JSON.stringify(active).length < 2048);
  pending.forEach(resolve => resolve({ isError: true, content: [{ text: 'private-result-canary' }] })); await Promise.all(calls);
  const done = snapshot(); assert.equal(done.pending, 0); assert.deepEqual(done.active, []); assert.equal(done.recent.length, 4);
  assert.ok(done.recent.every(value => value.outcome === 'tool_error')); assert.equal(JSON.stringify(done).includes('private-'), false);
});
