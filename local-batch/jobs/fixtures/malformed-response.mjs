// Private IPC fault fixture. No filesystem, browser, shell or descendant effects.
process.once('message', () => { process.send(null); setInterval(() => {}, 1000); });
