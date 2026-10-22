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
