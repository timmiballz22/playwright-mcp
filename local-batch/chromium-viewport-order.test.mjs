import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { jpegSize } from '../tests/fixtures/video-input-observer.mjs';

test('real full Chromium applies device metrics after the existing window-bounds request completes', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    const page = await browser.newPage();
    await page.setContent('<style>html,body{margin:0;background:rgb(255,0,0)}</style>');
    const client = page._connection.toImpl(page).delegate._mainFrameSession._client;
    const send = client.send;
    let bounds = 0, metrics = 0, boundsCompleted = false, metricsBeforeBoundsCompleted = false;
    client.send = async function (method, ...args) {
      if (method === 'Browser.setWindowBounds') {
        bounds++;
        // Delay actual dispatch to expose a lagging window effect. No fake
        // acknowledgment or replacement of browser geometry/response/source.
        await new Promise(resolve => setTimeout(resolve, 100));
        const result = await Reflect.apply(send, this, [method, ...args]);
        boundsCompleted = true;
        return result;
      }
      if (method === 'Emulation.setDeviceMetricsOverride') {
        metrics++;
        if (!boundsCompleted) metricsBeforeBoundsCompleted = true;
      }
      return Reflect.apply(send, this, [method, ...args]);
    };
    try { await page.setViewportSize({ width: 320, height: 240 }); }
    finally { client.send = send; }
    assert.equal(bounds, 1); assert.equal(metrics, 1);
    let firstFrame;
    const received = new Promise(resolve => { firstFrame = resolve; });
    let frameTimer;
    let firstInput;
    await page.screencast.start({ size: { width: 320, height: 240 }, fps: 10,
      onFrame: frame => firstFrame({ ...jpegSize(frame.data), viewportWidth: frame.viewportWidth, viewportHeight: frame.viewportHeight }) });
    try {
      firstInput = await Promise.race([received, new Promise((_, reject) => {
        frameTimer = setTimeout(() => reject(new Error('owned_first_screencast_frame_unavailable')), 5000);
      })]);
      assert.deepEqual(firstInput, { width: 320, height: 240, viewportWidth: 320, viewportHeight: 240 },
          JSON.stringify({ fixture: 'chromium_viewport_first_input', firstInput, metricsBeforeBoundsCompleted }));
    } finally { clearTimeout(frameTimer); await page.screencast.stop(); }
    assert.equal(boundsCompleted, true); assert.equal(metricsBeforeBoundsCompleted, false);
    assert.deepEqual(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })), { width: 320, height: 240 });
    const image = PNG.sync.read(await page.screenshot());
    assert.equal(image.width, 320); assert.equal(image.height, 240);
    const offset = (100 * image.width + 100) * 4;
    assert.deepEqual([...image.data.subarray(offset, offset + 4)], [255, 0, 0, 255]);
    console.log(JSON.stringify({ fixture: 'chromium_viewport_order_calibration', engine: 'chromium', channel: 'chromium',
      bounds, metrics, boundsCompleted, metricsBeforeBoundsCompleted, firstInput, platform: process.platform, width: 320, height: 240, redPixel: true,
      scope: 'Actual first JPEG after controlled window-request dispatch lag on this executing host; unforced native macOS cause remains separate.' }));
  } finally { await browser.close(); }
});
