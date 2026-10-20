import { open } from 'node:fs/promises';
import { constants } from 'node:fs';

const limit = 1048576;
// O_NONBLOCK prevents a POSIX FIFO from hanging before its type can be checked.
// Reads stay bounded even if a regular file grows after fstat.
export async function readWorkflowFile(filename) {
  const file = await open(filename, constants.O_RDONLY | (constants.O_NONBLOCK || 0));
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > limit)
      throw new TypeError('Workflow must be a regular file of at most 1 MiB');
    const bytes = Buffer.alloc(limit + 1);
    let used = 0;
    while (used < bytes.length) {
      const { bytesRead } = await file.read(bytes, used, bytes.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used > limit) throw new TypeError('Workflow exceeds 1 MiB');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, used)));
  } finally {
    await file.close();
  }
}
