// Trusted test module: advance wall time only when a finish mutation arrives.
import '../journal-worker.mjs';
const actualNow = Date.now;
process.prependListener('message', packet => {
  if (packet.command === 'finish') Date.now = () => actualNow() + 86400000;
});
