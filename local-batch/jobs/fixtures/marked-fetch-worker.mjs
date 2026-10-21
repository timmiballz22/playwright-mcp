// Checkout-only public API observation; no production hook or workflow option.
// Set the same private temporary location before Playwright's first import.
import path from 'node:path';
process.once('message', async packet => {
  if (packet.type !== 'start') return;
  const temporary = packet.temporaryRoot ?? path.join(packet.workspaceRoot, 'tmp');
  process.env.TMPDIR = temporary; process.env.TEMP = temporary; process.env.TMP = temporary;
  const playwright = await import('playwright');
  let sequence = 0;
  const type = playwright[packet.workflow.browser ?? 'chromium'];
  const connect = type.connect.bind(type);
  type.connect = async (...args) => {
    const browser = await connect(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...args) => {
      const context = await newContext(...args);
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
          return invoke();
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
