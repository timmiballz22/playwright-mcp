// Private serialization fault injection; workflows cannot select this module.
// Exercise the real report writer/worker envelope after real browser effects.
const stringify = JSON.stringify;
JSON.stringify = (value, ...args) => stringify(value?.reportScope === 'worker_execution' && Array.isArray(value.results)
  ? { ...value, privateFixture: 'fake-report-secret-' + 'x'.repeat(8 * 1024 * 1024) } : value, ...args);
await import('../../execution-worker.mjs');
