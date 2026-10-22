/** Copyright 2026 contributors. Licensed under Apache-2.0. */
// Trusted test preload. Observe bounded JPEG metadata only; forward every write
// with its original receiver, arguments, return value and callback.
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

export function jpegSize(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) return undefined;
  const limit = Math.min(bytes.length, 65536);
  // JPEG markers preceding scan data. Never scan entropy-coded image content.
  for (let offset = 2; offset < limit;) {
    if (bytes[offset++] !== 255) return undefined;
    while (offset < limit && bytes[offset] === 255) offset++;
    if (offset >= limit) return undefined;
    const marker = bytes[offset++];
    if (marker === 218 || marker === 217) return undefined;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    if (offset + 2 > limit) return undefined;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > limit) return undefined;
    if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
      if (length < 8) return undefined;
      return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
}

const spawn = childProcess.spawn;
let encoders = 0;
childProcess.spawn = function (...args) {
  const child = Reflect.apply(spawn, this, args);
  const flags = args[1];
  if (Array.isArray(flags) && flags.includes('matroska') && flags.includes('libvpx-vp9') && child.stdin && encoders < 4) {
    const encoder = ++encoders;
    const write = child.stdin.write;
    let frames = 0;
    child.stdin.write = function (...writeArgs) {
      if (frames < 8) {
        const size = jpegSize(writeArgs[0]);
        if (size) {
          frames++;
          process.stderr.write(JSON.stringify({ fixture: 'owned_video_encoder_input', encoder, frame: frames, ...size }) + '\n');
        }
      }
      return Reflect.apply(write, this, writeArgs);
    };
  }
  return child;
};
syncBuiltinESMExports();
