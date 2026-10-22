import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { serveMedia } from '../tests/fixtures/media-response.mjs';
const source = Buffer.from('0123456789abcdef');
async function fixture(run, payload = source) {
  const server = createServer((request, response) => serveMedia(request, response, payload, 'audio/wav'));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const call = (method = 'GET', headers = {}) => new Promise((resolve, reject) => {
    const request = httpRequest({ host: '127.0.0.1', port: server.address().port, method, headers: { Connection: 'close', ...headers } }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, bytes: Buffer.concat(chunks) }));
      response.on('error', reject);
    }); request.on('error', reject); request.end();
  });
  try { await run(call); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test('owned media full GET and bodyless HEAD describe the same exact representation', async () => fixture(async call => {
  const full = await call(); assert.equal(full.status, 200); assert.deepEqual(full.bytes, source);
  assert.equal(full.headers['content-length'], '16'); assert.equal(full.headers['accept-ranges'], 'bytes');
  const head = await call('HEAD', { Range: 'bytes=0-1' });
  assert.equal(head.status, 200); assert.equal(head.bytes.length, 0); assert.equal(head.headers['content-length'], '16');
}));
test('owned media range delivery supports middle, suffix, open and clamped ranges', async () => fixture(async call => {
  for (const [range, expected, contentRange] of [
    ['bytes=3-7', '34567', 'bytes 3-7/16'], ['bytes=-3', 'def', 'bytes 13-15/16'],
    ['bytes=10-', 'abcdef', 'bytes 10-15/16'], ['bytes=12-999', 'cdef', 'bytes 12-15/16'],
    ['bytes=-999', source.toString(), 'bytes 0-15/16'],
  ]) {
    const result = await call('GET', { Range: range }); assert.equal(result.status, 206);
    assert.equal(result.bytes.toString(), expected); assert.equal(result.headers['content-range'], contentRange);
    assert.equal(Number(result.headers['content-length']), Buffer.byteLength(expected));
  }
}));
test('owned media malformed or unsatisfiable ranges return no representation bytes', async () => fixture(async call => {
  for (const range of ['bytes=16-', 'bytes=7-3', 'bytes=-0', 'bytes=-', 'bytes=999999999999999999999-']) {
    const result = await call('GET', { Range: range }); assert.equal(result.status, 416);
    assert.equal(result.bytes.length, 0); assert.equal(result.headers['content-range'], 'bytes */16');
    assert.equal(result.headers['content-length'], '0');
  }
}));
test('owned media ranges reconstruct original bytes and unmatched If-Range returns full data', async () => fixture(async call => {
  const first = await call('GET', { Range: 'bytes=0-7' }), second = await call('GET', { Range: 'bytes=8-' });
  assert.deepEqual(Buffer.concat([first.bytes, second.bytes]), source);
  for (const headers of [{ Range: 'bytes=0-1', 'If-Range': '"unavailable-validator"' },
    { Range: 'other=0-2' }, { Range: 'bytes=0-1,3-4' }]) {
    const unmatched = await call('GET', headers);
    assert.equal(unmatched.status, 200); assert.deepEqual(unmatched.bytes, source);
  }
}));
test('owned media endpoint rejects unsupported methods without serving media', async () => fixture(async call => {
  const result = await call('POST'); assert.equal(result.status, 405);
  assert.equal(result.headers.allow, 'GET, HEAD'); assert.equal(result.bytes.length, 0);
}));

test('owned media full and ranged responses preserve nulls and non-UTF8 binary bytes', async () => {
  const payload = Buffer.from([0, 255, 128, 13, 10, 127, 195, 169]);
  await fixture(async call => {
    const full = await call(); assert.deepEqual(full.bytes, payload);
    const part = await call('GET', { Range: 'bytes=1-5' });
    assert.equal(part.status, 206); assert.deepEqual(part.bytes, Buffer.from([255, 128, 13, 10, 127]));
    assert.equal(part.headers['content-range'], 'bytes 1-5/8');
  }, payload);
});
