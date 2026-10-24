// Owned media fixtures only: preserve exact bytes while supporting one HTTP range.
/**
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @param {Buffer} bytes
 * @param {string} contentType
 */
export function serveMedia(request, response, bytes, contentType) {
  if (!['GET', 'HEAD'].includes(request.method ?? '')) {
    response.writeHead(405, { Allow: 'GET, HEAD', 'Content-Length': 0 }); response.end(); return;
  }
  const headers = { 'Content-Type': contentType, 'Accept-Ranges': 'bytes' };
  // HEAD ignores Range. No validator is supplied, so If-Range cannot match.
  const range = request.method === 'GET' && !request.headers['if-range'] ? request.headers.range : undefined;
  // Ignore unsupported units/multipart requests rather than mislabeling valid
  // ranges as unsatisfiable. This fixture implements single byte ranges only.
  if (range === undefined || typeof range === 'string' && (!/^bytes=/i.test(range) || range.includes(','))) {
    response.writeHead(200, { ...headers, 'Content-Length': bytes.length });
    response.end(request.method === 'HEAD' ? undefined : bytes); return;
  }
  const match = typeof range === 'string' ? /^bytes=(\d*)-(\d*)$/i.exec(range) : null;
  let start = 0, end = bytes.length - 1, valid = !!match && !!(match[1] || match[2]);
  if (valid && match) {
    if (!match[1]) {
      const suffix = Number(match[2]); valid = Number.isSafeInteger(suffix) && suffix > 0;
      start = Math.max(0, bytes.length - suffix);
    } else {
      start = Number(match[1]);
      if (match[2]) end = Math.min(Number(match[2]), bytes.length - 1);
      valid = Number.isSafeInteger(start) && (!match[2] || Number.isSafeInteger(Number(match[2])));
    }
    valid = valid && start >= 0 && start <= end && start < bytes.length;
  }
  if (!valid) {
    response.writeHead(416, { ...headers, 'Content-Range': `bytes */${bytes.length}`, 'Content-Length': 0 }); response.end(); return;
  }
  response.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${bytes.length}`, 'Content-Length': end - start + 1 });
  response.end(bytes.subarray(start, end + 1));
}
