// Trusted positive-control fixture only. Public workflow JSON cannot select this
// module or override context policy. The control explicitly approves both origins.
import { chromium } from 'playwright';
const connect = chromium.connect.bind(chromium);
chromium.connect = async (...args) => {
  const browser = await connect(...args);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = options => newContext({ ...options, serviceWorkers: 'allow' });
  return browser;
};
await import('../execution-worker.mjs');
