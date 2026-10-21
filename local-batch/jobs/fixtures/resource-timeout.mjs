// Trusted fault fixture: hold resource admission before any browser effect.
import '../journal-worker.mjs';
process.prependListener('message', packet => {
  if (packet.command === 'resources') Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
});
