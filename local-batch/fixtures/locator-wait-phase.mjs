// Trusted phase witness only. Workflow JSON cannot select or configure it.
import { chromium } from 'playwright';
import { writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import '../execution-worker.mjs';
let workspace;
process.prependOnceListener('message', packet => { workspace = packet.workspaceRoot; });
const connect = chromium.connect.bind(chromium);
chromium.connect = async (...args) => {
  const browser = await connect(...args);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...options) => {
    const context = await newContext(...options);
    const newPage = context.newPage.bind(context);
    context.newPage = async (...options) => {
      const page = await newPage(...options);
      const locate = page.locator.bind(page);
      page.locator = (...args) => {
        const locator = locate(...args); const waitFor = locator.waitFor.bind(locator);
        locator.waitFor = async (...options) => {
          const wait = waitFor(...options); let settled = false;
          void wait.then(() => { settled = true; }, () => { settled = true; });
          await new Promise(resolve => setImmediate(resolve));
          const temporary = path.join(workspace, 'locator-phase-fixture.tmp');
          await writeFile(temporary, JSON.stringify({ pending: !settled }), { flag: 'wx', mode: 0o600 });
          await rename(temporary, path.join(workspace, 'locator-phase-fixture.json'));
          return wait;
        };
        return locator;
      };
      return page;
    };
    return context;
  };
  return browser;
};
