// Trusted fault fixture: exit before a read handler, without a browser or mutation.
import '../journal-worker.mjs';
process.prependListener('message', packet => { if (packet.command === 'read') process.exit(17); });
