// Per-run screenshot bytes only. Report/history quotas and browser-memory caps
// are separate. Caller owns a private unique run directory and ordered indices.
import { lstat, open, link, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
export const DEFAULT_SCREENSHOT_BYTES = 16777216;
export function validateScreenshotLimit(value = DEFAULT_SCREENSHOT_BYTES) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 268435456) throw new TypeError('Invalid operator screenshot byte limit');
  return value;
}
export function parseScreenshotLimit(value) {
  if (value === undefined) return DEFAULT_SCREENSHOT_BYTES;
  if (typeof value !== 'string' || !/^\d{1,9}$/.test(value)) throw new TypeError('Invalid operator screenshot byte limit');
  return validateScreenshotLimit(Number(value));
}
const failure = code => Object.assign(new Error('Screenshot publication failed'), { code });
export class ScreenshotBudget {
  #limit; #used = 0;
  constructor(limit) { this.#limit = validateScreenshotLimit(limit); }
  get used() { return this.#used; }
  async publish(page, target, { canPublish = () => true } = {}) {
    try { await lstat(target); throw failure('ARTIFACT_COLLISION'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    // Passing no path prevents Playwright from writing before quota validation.
    const bytes = await page.screenshot({ fullPage: false });
    if (!Buffer.isBuffer(bytes)) throw failure('INVALID_SCREENSHOT');
    if (!canPublish()) throw failure('ARTIFACT_CANCELLED');
    if (bytes.length > this.#limit - this.#used) throw failure('SCREENSHOT_BYTE_LIMIT');
    this.#used += bytes.length; // Conservatively reserve even on subsequent I/O error.
    const temporary = path.join(path.dirname(target), '.capture-' + randomUUID() + '.tmp');
    let file; let created = false;
    try {
      if (!canPublish()) throw failure('ARTIFACT_CANCELLED');
      file = await open(temporary, 'wx', 0o600); created = true;
      await file.writeFile(bytes); await file.close(); file = undefined;
      if (!canPublish()) throw failure('ARTIFACT_CANCELLED');
      // Atomic create-if-absent: rename would replace a target created while
      // capture or file I/O was pending. Both names are in this private directory.
      try { await link(temporary, target); }
      catch (error) { if (error.code === 'EEXIST') throw failure('ARTIFACT_COLLISION'); throw error; }
    } finally {
      await file?.close().catch(() => {});
      if (created) await rm(temporary, { force: true });
    }
  }
}
