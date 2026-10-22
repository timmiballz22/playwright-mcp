// Checkout-only public API observation; no production hook or workflow option.
// Set the same private temporary location before Playwright's first import.
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
process.once('message', async packet => {
  if (packet.type !== 'start') return;
  const temporary = packet.temporaryRoot ?? path.join(packet.workspaceRoot, 'tmp');
  process.env.TMPDIR = temporary; process.env.TEMP = temporary; process.env.TMP = temporary;
  const playwright = await import('playwright');
  let sequence = 0;
  const type = playwright[packet.workflow.browser ?? 'chromium'];
  const heldClose = process.env.PLAYWRIGHT_TEST_PRIVATE_FETCH_CLOSE_STALL === '1';
  const neverClose = () => new Promise(() => {});
  if (heldClose) {
    const launchServer = type.launchServer.bind(type);
    type.launchServer = async (...args) => {
      const server = await launchServer(...args);
      server.close = neverClose; // Actual factory kill handle remains intact.
      return server;
    };
  }
  const connect = type.connect.bind(type);
  type.connect = async (...args) => {
    const browser = await connect(...args);
    if (heldClose) browser.close = neverClose;
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...args) => {
      const context = await newContext(...args);
      if (heldClose) context.close = neverClose;
      if (heldClose) {
        const newPage = context.newPage.bind(context);
        context.newPage = async (...args) => {
          const page = await newPage(...args);
          const locator = page.locator.bind(page);
          page.locator = (...args) => {
            const target = locator(...args);
            const click = target.click.bind(target);
            target.click = async options => {
              try { return await click(options); }
              catch (error) {
                if (options?.signal?.aborted && browser.isConnected()) {
                  await writeFile(path.join(packet.workspaceRoot, 'action-abort-witness.json'), JSON.stringify({ signalAborted: true, browserConnected: true, action: 'click' }), { flag: 'wx', mode: 0o600 });
                }
                throw error;
              }
            };
            return target;
          };
          return page;
        };
      }
      const register = context.route.bind(context);
      context.route = (pattern, handler, ...options) => register(pattern, async route => {
        const fetch = route.fetch.bind(route);
        route.fetch = async (options = {}) => {
          const headers = { ...await route.request().allHeaders(), ...options.headers };
          const invoke = () => fetch({ ...options, headers: { ...headers, 'x-pwmcp-private-fetch': String(++sequence) } });
          // Explicit negative control: replay a committed private fixture POST.
          // This switch is never read by production code or workflow JSON.
          if (process.env.PLAYWRIGHT_TEST_PRIVATE_FETCH_REPLAY === '1' && route.request().method() === 'POST')
            return (await Promise.all([invoke(), invoke()]))[0];
          try { return await invoke(); }
          catch (error) {
            if (heldClose && options.signal?.aborted && browser.isConnected() && route.request().method() === 'POST') {
              await writeFile(path.join(packet.workspaceRoot, 'fetch-abort-witness.json'), JSON.stringify({ signalAborted: true, browserConnected: true, method: 'POST' }), { flag: 'wx', mode: 0o600 });
            }
            throw error;
          }
        };
        return handler(route);
      }, ...options);
      return context;
    };
    return browser;
  };
  await import('../../execution-worker.mjs');
  process.emit('message', packet);
});
