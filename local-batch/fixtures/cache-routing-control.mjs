// Trusted owned-fixture control only. This module disables HTTP interception to
// measure browser caching; it is never selectable through public workflow JSON.
import { chromium } from 'playwright';
const connect = chromium.connect.bind(chromium);
chromium.connect = async (...args) => {
  const browser = await connect(...args);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async options => {
    const context = await newContext(options);
    context.route = async () => {};
    return context;
  };
  return browser;
};
// Compose the existing cache control with checkout-only live factory evidence.
// Normal installed execution never selects this worker or this private flag.
if (process.env.PLAYWRIGHT_TEST_LIFETIME_CONTROL)
  await import('../jobs/fixtures/lifetime-gated-worker.mjs');
else
  await import('../execution-worker.mjs');
