// Trusted fault fixture only: terminate the exact child handle returned by our
// own BrowserServer while its real screenshot promise is still pending.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
let workspace; let child;
process.once('message', packet => { workspace = packet.workspaceRoot; });
const launchServer = chromium.launchServer.bind(chromium);
chromium.launchServer = async (...args) => {
  const server = await launchServer(...args); child = server.process(); return server;
};
const connect = chromium.connect.bind(chromium);
chromium.connect = async (...args) => {
  const browser = await connect(...args);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...options) => {
    const context = await newContext(...options);
    const newPage = context.newPage.bind(context);
    context.newPage = async (...pageOptions) => {
      const page = await newPage(...pageOptions);
      const screenshot = page.screenshot.bind(page);
      page.screenshot = async (...screenshotOptions) => {
        const capture = screenshot(...screenshotOptions); let settled = false;
        void capture.then(() => { settled = true; }, () => { settled = true; });
        await new Promise(resolve => setImmediate(resolve));
        const pending = !settled;
        const killed = pending && child.exitCode === null && child.signalCode === null && child.kill('SIGKILL');
        await writeFile(path.join(workspace, 'browser-crash-fixture.json'), JSON.stringify({ pending, killed }), { flag: 'wx', mode: 0o600 });
        return capture;
      };
      return page;
    };
    return context;
  };
  return browser;
};
await import('../execution-worker.mjs');
