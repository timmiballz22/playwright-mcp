// Trusted QA bootstrap: import the existing test unchanged; real Firefox only.
import { firefox } from '/workspace/playwright-mcp/node_modules/playwright/index.mjs';
const launchServer = firefox.launchServer.bind(firefox);
firefox.launchServer = async options => {
  const server = await launchServer(options);
  const close = server.close.bind(server);
  const kill = server.kill.bind(server);
  server.close = async () => { await close(); return new Promise(() => {}); };
  server.kill = async () => { await kill(); return new Promise(() => {}); };
  return server;
};
await import('/workspace/playwright-mcp/local-batch/integration.test.mjs');
