import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

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
        const result = await Reflect.apply(send, this, [method, ...args]);
        // Trusted scheduling calibration after the actual protocol effect.
        // No replacement of browser geometry, response or source implementation.
        await new Promise(resolve => setTimeout(resolve, 100));
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
    assert.equal(boundsCompleted, true); assert.equal(metricsBeforeBoundsCompleted, false);
    assert.deepEqual(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })), { width: 320, height: 240 });
    const image = PNG.sync.read(await page.screenshot());
    assert.equal(image.width, 320); assert.equal(image.height, 240);
    const offset = (100 * image.width + 100) * 4;
    assert.deepEqual([...image.data.subarray(offset, offset + 4)], [255, 0, 0, 255]);
    console.log(JSON.stringify({ fixture: 'chromium_viewport_order_calibration', engine: 'chromium', channel: 'chromium',
      bounds, metrics, boundsCompleted, metricsBeforeBoundsCompleted, width: 320, height: 240, redPixel: true,
      scope: 'Request sequencing with a real Linux/Windows/macOS engine on the executing host; native gray cause is a separate measurement.' }));
  } finally { await browser.close(); }
});
