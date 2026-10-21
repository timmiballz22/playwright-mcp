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
await import('../execution-worker.mjs');
