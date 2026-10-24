import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStderrCapture, STDERR_BYTE_LIMIT } from '../tests/fixtures/bounded-stderr.mjs';

test('stderr capture preserves split UTF-8 bytes and owns its bounded storage', () => {
  const capture = createStderrCapture();
  const bytes = Buffer.from('é🌍');
  for (const byte of bytes) capture.observe(Buffer.from([byte]));
  bytes.fill(120);
  assert.equal(capture.text(), 'é🌍');
  const source = Buffer.from('private'); capture.observe(source); source.fill(120);
  assert.equal(capture.text(), 'é🌍private');
  assert.deepEqual(capture.snapshot(), { byteLimit: STDERR_BYTE_LIMIT, retainedBytes: 13, overflow: false });
});

test('stderr capture accepts its exact byte boundary and rejects overflow without leaking text', () => {
  const capture = createStderrCapture();
  for (let index = 0; index < 16; index++) capture.observe(Buffer.alloc(STDERR_BYTE_LIMIT / 16, 120));
  assert.equal(capture.text().length, STDERR_BYTE_LIMIT);
  capture.observe(Buffer.from('private-overflow-canary'));
  for (let index = 0; index < 100; index++) capture.observe(Buffer.alloc(65536, 120));
  assert.deepEqual(capture.snapshot(), { byteLimit: STDERR_BYTE_LIMIT, retainedBytes: STDERR_BYTE_LIMIT, overflow: true });
  assert.throws(() => capture.text(), { code: 'fixture_stderr_output_limit', message: 'fixture_stderr_output_limit' });
  assert.throws(() => capture.assertWithinLimit(), { code: 'fixture_stderr_output_limit' });
  assert.equal(JSON.stringify(capture.snapshot()).includes('private-overflow-canary'), false);
});

test('one oversized stderr chunk is bounded immediately and invalid chunks are rejected', () => {
  const capture = createStderrCapture();
  capture.observe(Buffer.alloc(STDERR_BYTE_LIMIT * 2));
  assert.equal(capture.snapshot().retainedBytes, STDERR_BYTE_LIMIT);
  assert.equal(capture.snapshot().overflow, true);
  assert.throws(() => capture.observe('private-canary'), { message: 'invalid_fixture_stderr_chunk' });
});

// Real transport calibration: a naturally exiting descendant keeps the actual
// inherited stderr pipe open after its parent exits. No synthetic EOF/close.
async function inheritedStderrFixture(delay, callback) {
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const { closeWithStderr } = await import('../tests/fixtures/close-with-stderr.mjs');
  const transport = new StdioClientTransport({ command: process.execPath,
    args: ['-e', `const {spawn}=require('node:child_process');process.stderr.write('fixed-fixture');process.stdin.resume();process.stdin.once('end',()=>{spawn(process.execPath,['-e','setTimeout(()=>process.exit(0),${delay})'],{stdio:['ignore','ignore',2]});process.exit(0);});`], stderr: 'pipe' });
  const capture = createStderrCapture(); let ended = false;
  const eof = new Promise(resolve => transport.stderr.once('end', () => { ended = true; resolve(); }));
  transport.stderr.on('data', chunk => capture.observe(chunk));
  await transport.start();
  try { await callback({ transport, capture, eof, ended: () => ended, closeWithStderr }); }
  finally { await transport.close(); await eof; capture.assertWithinLimit(); }
}

test('actual SDK close can precede stderr EOF; joined teardown drains within its existing ceiling', { timeout: 10000 }, async () => {
  await inheritedStderrFixture(2600, async ({ transport, capture, eof, ended, closeWithStderr }) => {
    let atClose;
    await closeWithStderr(async () => { await transport.close(); atClose = ended(); }, eof);
    assert.equal(atClose, false); assert.equal(ended(), true);
    assert.equal(capture.text(), 'fixed-fixture');
  });
});

test('actual inherited stderr beyond the existing ceiling stays a failed unconfirmed teardown', { timeout: 10000 }, async () => {
  await inheritedStderrFixture(4600, async ({ transport, eof, ended, closeWithStderr }) => {
    await assert.rejects(closeWithStderr(() => transport.close(), eof), { message: 'fixture_close_or_stderr_unconfirmed' });
    assert.equal(ended(), false); // Later natural EOF cannot retroactively pass this close.
  });
});

test('joined teardown preserves a close rejection after actual EOF', async () => {
  const { closeWithStderr } = await import('../tests/fixtures/close-with-stderr.mjs');
  const primary = new Error('fixed-close-failure');
  await assert.rejects(closeWithStderr(() => Promise.reject(primary), Promise.resolve()), error => {
    assert.equal(error instanceof AggregateError, true); assert.deepEqual(error.errors, [primary]); return true;
  });
});
