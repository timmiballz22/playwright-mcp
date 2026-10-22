// Source-test diagnostics only. Continue draining after overflow so the child
// cannot block on its pipe, but never accept truncated diagnostics as complete.
export const STDERR_BYTE_LIMIT = 1048576;
export function createStderrCapture() {
  let bytes; let retainedBytes = 0; let overflow = false;
  const assertWithinLimit = () => {
    if (overflow) throw Object.assign(new Error('fixture_stderr_output_limit'), { code: 'fixture_stderr_output_limit' });
  };
  return {
    observe(chunk) {
      if (!Buffer.isBuffer(chunk)) throw new TypeError('invalid_fixture_stderr_chunk');
      if (overflow || !chunk.length) return;
      const length = Math.min(chunk.length, STDERR_BYTE_LIMIT - retainedBytes);
      if (length) {
        const needed = retainedBytes + length;
        if (!bytes || needed > bytes.length) {
          const capacity = Math.min(STDERR_BYTE_LIMIT, Math.max(4096, (bytes?.length ?? 0) * 2, needed));
          const next = Buffer.alloc(capacity);
          bytes?.copy(next, 0, 0, retainedBytes);
          bytes = next;
        }
        chunk.copy(bytes, retainedBytes, 0, length);
        retainedBytes += length;
      }
      overflow = length !== chunk.length;
    },
    text() { assertWithinLimit(); return bytes ? bytes.toString('utf8', 0, retainedBytes) : ''; },
    snapshot() { return { byteLimit: STDERR_BYTE_LIMIT, retainedBytes, overflow }; },
    assertWithinLimit,
  };
}
