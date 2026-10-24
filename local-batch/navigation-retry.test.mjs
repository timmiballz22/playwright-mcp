import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigationRetryPolicy, navigationRetryDelay, parseRetryAfter } from './navigation-retry.mjs';

test('navigation retry policy is bounded, disabled by default and copied', () => {
  assert.equal(navigationRetryPolicy(), null);
  const input = { maxRetries: 2, baseDelayMs: 100, maxDelayMs: 5000 };
  const policy = navigationRetryPolicy(input); input.maxRetries = 99;
  assert.equal(policy.maxRetries, 2);
  for (const value of [null, [], { maxRetries: 3 }, { maxRetries: 1, maxDelayMs: 0 }, { maxRetries: 1, force: true }])
    assert.throws(() => navigationRetryPolicy(value), TypeError);
});

test('Retry-After is a minimum wait and an excessive wait is never shortened', () => {
  const policy = navigationRetryPolicy({ maxRetries: 2, baseDelayMs: 100, maxDelayMs: 5000 });
  assert.equal(parseRetryAfter('2', 0), 2000);
  assert.equal(parseRetryAfter('Thu, 01 Jan 1970 00:00:03 GMT', 0), 3000);
  assert.equal(parseRetryAfter('999999999999999999999', 0), Infinity);
  assert.equal(parseRetryAfter('canary-secret', 0), undefined);
  assert.equal(navigationRetryDelay(429, '2', 0, policy, 0, 0), 2000);
  assert.equal(navigationRetryDelay(503, '6', 0, policy, 0, 0), null);
  assert.equal(navigationRetryDelay(429, '999999999999999999999', 0, policy, 0, 0), null);
  assert.equal(navigationRetryDelay(503, undefined, 1, policy, 0, 0.5), 225);
  for (const status of [200, 301, 401, 403, 404, 500])
    assert.equal(navigationRetryDelay(status, '1', 0, policy), null);
  assert.equal(navigationRetryDelay(429, '1', 2, policy), null);
  assert.equal(navigationRetryDelay(429, '1', 0, null), null);
});
