// Trusted test module: advance wall time only when a finish mutation arrives.
const actualNow = Date.now;
process.prependListener('message', packet => {
  if (packet.command === 'finish') Date.now = () => actualNow() + 86400000;
});
await import('../journal-worker.mjs');
