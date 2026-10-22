import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { jpegSize } from '../tests/fixtures/video-input-observer.mjs';

test('real full Chromium applies device metrics after the existing window-bounds request completes', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ channel: 'chromium' });
  let detachTrace;
  try {
    const page = await browser.newPage();
    await page.setContent('<style>html,body{margin:0;background:rgb(255,0,0)}</style>');
    const client = page._connection.toImpl(page).delegate._mainFrameSession._client;
    const trace = []; const started = performance.now(); let traceDropped = 0, rawFrameObserved = false;
    const record = (stage, facts = {}) => {
      if (trace.length < 16) trace.push({ stage, offsetMs: Math.round((performance.now() - started) * 1000) / 1000, ...facts });
      else traceDropped++;
    };
    const resized = () => record('frame_resized');
    const rawFrame = event => {
      if (rawFrameObserved) return; rawFrameObserved = true;
      const metadata = event.metadata ?? {};
      record('first_native_frame', Object.fromEntries(['deviceWidth', 'deviceHeight', 'pageScaleFactor', 'offsetTop']
          .filter(key => Number.isFinite(metadata[key])).map(key => [key, metadata[key]])));
    };
    client.on('Page.frameResized', resized); client.on('Page.screencastFrame', rawFrame);
    detachTrace = () => { client.off('Page.frameResized', resized); client.off('Page.screencastFrame', rawFrame); };
    const send = client.send;
    let bounds = 0, metrics = 0, boundsCompleted = false, metricsBeforeBoundsCompleted = false;
    client.send = async function (method, ...args) {
      if (method === 'Browser.setWindowBounds') {
        bounds++;
        // Delay actual dispatch to expose a lagging window effect. No fake
        // acknowledgment or replacement of browser geometry/response/source.
        await new Promise(resolve => setTimeout(resolve, 100));
        record('window_sent', { width: args[0]?.bounds?.width, height: args[0]?.bounds?.height });
        const result = await Reflect.apply(send, this, [method, ...args]);
        boundsCompleted = true;
        record('window_ack');
        return result;
      }
      if (method === 'Emulation.setDeviceMetricsOverride') {
        metrics++;
        if (!boundsCompleted) metricsBeforeBoundsCompleted = true;
        record('metrics_sent', { width: args[0]?.width, height: args[0]?.height });
        const result = await Reflect.apply(send, this, [method, ...args]);
        record('metrics_ack');
        return result;
      }
      return Reflect.apply(send, this, [method, ...args]);
    };
    try { await page.setViewportSize({ width: 320, height: 240 }); }
    finally { client.send = send; }
    record('viewport_api_resolved');
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
          JSON.stringify({ fixture: 'chromium_viewport_first_input', firstInput, metricsBeforeBoundsCompleted, trace, traceDropped }));
    } finally { clearTimeout(frameTimer); await page.screencast.stop(); }
    assert.equal(boundsCompleted, true); assert.equal(metricsBeforeBoundsCompleted, false);
    assert.deepEqual(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })), { width: 320, height: 240 });
    const image = PNG.sync.read(await page.screenshot());
    assert.equal(image.width, 320); assert.equal(image.height, 240);
    const offset = (100 * image.width + 100) * 4;
    assert.deepEqual([...image.data.subarray(offset, offset + 4)], [255, 0, 0, 255]);
    console.log(JSON.stringify({ fixture: 'chromium_viewport_order_calibration', engine: 'chromium', channel: 'chromium',
      bounds, metrics, boundsCompleted, metricsBeforeBoundsCompleted, firstInput, trace, traceDropped, platform: process.platform, width: 320, height: 240, redPixel: true,
      scope: 'Actual first JPEG after controlled window-request dispatch lag on this executing host; unforced native macOS cause remains separate.' }));
  } finally { detachTrace?.(); await browser.close(); }
});
