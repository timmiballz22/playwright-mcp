// Checkout-only source IPC fault: retain the early HTTP fact, never a final report.
process.once('message', packet => {
  if (packet.type !== 'start') return;
  const mode = process.env.PLAYWRIGHT_TEST_HTTP_EARLY_MODE;
  process.send({ type: 'actionFailure', failedStep: { index: 1, type: 'goto', error: 'rate_limited', failureKind: 'http_failure',
    httpStatus: mode === 'bad_status' ? 'fake-http-status-canary' : 429, retryAfterMs: mode === 'bad_retry' ? 'fake-http-retry-canary' : 1000, secret: 'fake-http-early-private-canary' } });
  setInterval(() => {}, 1000);
});
