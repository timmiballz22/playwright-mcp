import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeWorkflow } from '../executor.mjs';
import { ownedDescendants } from '../fixtures/process-audit.mjs';
for (const mode of ['known', 'bad_status', 'bad_retry']) test(`early HTTP ${mode} projection preserves timeout and fixed validated facts`, { timeout: 10000 }, async () => {
  const owned = [];
  const previous = process.env.PLAYWRIGHT_TEST_HTTP_EARLY_MODE; process.env.PLAYWRIGHT_TEST_HTTP_EARLY_MODE = mode;
  let result;
  try { result = await executeWorkflow({ timeoutMs: 3000, steps: [{ type: 'goto', url: 'http://127.0.0.1:4321/' }] }, {
    allowedOrigins: ['http://127.0.0.1:4321'], workerModule: new URL('./fixtures/http-failure-stall.mjs', import.meta.url),
    onEvent: event => { if (event.pid) owned.push(event.pid); },
  }); } finally { if (previous === undefined) delete process.env.PLAYWRIGHT_TEST_HTTP_EARLY_MODE; else process.env.PLAYWRIGHT_TEST_HTTP_EARLY_MODE = previous; }
  assert.equal(result.reason, 'timeout'); assert.equal(result.ok, false); assert.equal(result.completed, 0); assert.equal(result.retrySafe, false);
  assert.equal(result.failedStep.error, 'rate_limited'); assert.equal(result.failedStep.httpStatus, mode === 'bad_status' ? undefined : 429); assert.equal(result.failedStep.retryAfterMs, mode === 'known' ? 1000 : undefined);
  assert.equal(JSON.stringify(result).includes('canary'), false);
  assert.equal(result.execution.cleanup, 'terminated'); assert.deepEqual(await ownedDescendants(owned), []);
});
