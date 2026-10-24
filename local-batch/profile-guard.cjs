'use strict';
// Thin composition over public Playwright APIs. The delegated tools and browser
// implementation stay upstream. Persistent context close awaits browser shutdown;
// disconnected events alone do not authorize releasing filesystem ownership.
const { acquireProfileLease, profileError } = require('./profile-lease.cjs');
const installed = Symbol.for('@timmiballz22/playwright-mcp.profile-guard.v1');
function installProfileGuard(playwright) {
  for (const name of ['chromium', 'firefox', 'webkit']) {
    const type = playwright[name];
    if (!type || type[installed]) continue;
    const launch = type.launchPersistentContext.bind(type);
    type.launchPersistentContext = async (directory, ...args) => {
      // Empty string is the official API's unique temporary-profile mode.
      if (typeof directory !== 'string' || directory === '') return launch(directory, ...args);
      const lease = await acquireProfileLease(directory);
      let context;
      try { context = await launch(directory, ...args); }
      catch (error) { lease.markUncertain(); throw error; }
      let closeContext;
      try {
        closeContext = context.close.bind(context);
        let closing;
        context.close = (...options) => {
          // A close event can precede the public shutdown acknowledgement.
          // Concurrent closes share that acknowledgement, including failure.
          if (!closing) closing = (async () => {
            if (context.isClosed() && !lease.released) { lease.markUncertain(); throw profileError('profile_cleanup_unknown'); }
            try {
              const result = await closeContext(...options);
              await lease.release(); return result;
            } catch (error) { lease.markUncertain(); throw error; }
          })();
          return closing;
        };
        const browser = context.browser();
        if (browser) {
          const closeBrowser = browser.close.bind(browser);
          browser.close = async (...options) => {
            if (lease.released) return closeBrowser(...options);
            // The public persistent-context close includes browser process/temp
            // shutdown and an acknowledged context close. A disconnected browser
            // close can swallow TargetClosedError; that is insufficient proof.
            return context.close(...options);
          };
        }
        return context;
      } catch (error) {
        lease.markUncertain();
        // Allocation already succeeded: even failed hook setup must close it.
        if (closeContext) {
          try { await closeContext(); await lease.release(); } catch { /* retain unknown ownership */ }
        }
        throw error;
      }
    };
    Object.defineProperty(type, installed, { value: true });
  }
}
module.exports = { installProfileGuard };
