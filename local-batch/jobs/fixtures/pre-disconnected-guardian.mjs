// Trusted race fixture: the frontend IPC closes before guardian handlers load.
const packet = await new Promise(resolve => process.once('message', resolve));
await new Promise(resolve => { process.once('disconnect', resolve); process.disconnect(); });
await import('../guardian.mjs');
process.emit('message', packet);
