// Run from a checkout with pinned dependencies and full Chromium installed:
// node docs/evidence/native97-public-first-frame-repro.mjs
// Diagnostic results only: exit0 means the probe completed, not capture acceptance.
import { chromium } from '/workspace/playwright-mcp/node_modules/playwright/index.mjs';
function dimensions(data) {
  const b = Buffer.from(data).subarray(0, 32768);
  if (b.length < 4 || b[0] !== 255 || b[1] !== 216) throw new Error('not_jpeg');
  let p = 2;
  while (p + 4 <= b.length) {
    if (b[p++] !== 255) throw new Error('jpeg_marker');
    while (b[p] === 255) p++;
    const marker = b[p++];
    if (marker === 217 || marker === 218) break;
    if (marker === 1 || marker >= 208 && marker <= 215) continue;
    const length = b.readUInt16BE(p);
    if (length < 2 || p + length > b.length) break;
    if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))
      return { width: b.readUInt16BE(p + 5), height: b.readUInt16BE(p + 3) };
    p += length;
  }
  throw new Error('jpeg_dimensions_unavailable');
}
const browser = await chromium.launch({ channel: 'chromium' });
const rows = [];
try {
  for (let i = 0; i < 8; i++) {
    const page = await browser.newPage();
    try {
      await page.setContent('<style>html,body{margin:0;background:red}</style>');
      await page.setViewportSize({ width: 320, height: 240 });
      let resolveFrame, timer;
      const received = new Promise(resolve => { resolveFrame = resolve; });
      await page.screencast.start({ size: { width: 320, height: 240 }, fps: 10,
        onFrame: frame => resolveFrame({ ...dimensions(frame.data), viewportWidth: frame.viewportWidth, viewportHeight: frame.viewportHeight }) });
      try {
        rows.push(await Promise.race([received, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('frame_unavailable')), 5000); })]));
      } finally { clearTimeout(timer); await page.screencast.stop(); }
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ scope: 'First received JPEG for each real fresh page, no skipped frames, screenshot, warmup, private API or source patch. Linux full Chromium control; not native macOS cause proof.', requested: { width: 320, height: 240 }, rows }));
