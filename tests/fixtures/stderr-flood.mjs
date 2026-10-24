// Trusted test preload. No browser, shell, page input or model execution.
const sizes = new Set(['983040', '1048577']);
const size = process.env.PLAYWRIGHT_TEST_STDERR_BYTES;
if (!sizes.has(size)) throw new Error('invalid_test_stderr_size');
const bytes = Buffer.alloc(Number(size), 120);
bytes.write('private-fixture-stderr-canary:');
await new Promise((resolve, reject) => process.stderr.write(bytes, error => error ? reject(error) : resolve()));
