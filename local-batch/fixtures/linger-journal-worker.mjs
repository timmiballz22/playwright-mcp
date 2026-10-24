// Trusted fixture only: keep post-disconnect bookkeeping alive briefly after
// the real journal has closed. No action, mutation or runtime timeout is changed.
import '../jobs/journal-worker.mjs';
process.once('disconnect', () => { setTimeout(() => {}, 500); });
