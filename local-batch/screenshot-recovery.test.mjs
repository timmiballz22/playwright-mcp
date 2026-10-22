import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

// Trusted protocol calibration around real installed Playwright. A successful
// owned capture is followed by a calibrated real ProtocolError. This verifies
// retry selection/bounds, not the cause of an intermittent native engine error.
test('Chromium screenshot retries only one exact calibrated capture-unavailable failure within its original deadline', { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const mode of ['healthy', 'first_unavailable', 'persistent_unavailable', 'other_protocol', 'closed_target', 'deadline']) {
      const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
      await page.setContent('<style>html,body{margin:0;background:rgb(255,0,0)}</style>');
      const impl = page._connection.toImpl(page);
      const client = impl.delegate._mainFrameSession._client;
      const send = client.send;
      let protocolError;
      try { await send.call(client, 'Page.captureScreenshot', { format: 'owned-invalid-format' }); }
      catch (error) { protocolError = error; }
      assert.equal(typeof protocolError?.setMessage, 'function');
      let attempts = 0;
      let actualCaptures = 0;
      client.send = async function (method, ...args) {
        if (method !== 'Page.captureScreenshot') return Reflect.apply(send, this, [method, ...args]);
        attempts++;
        const value = await Reflect.apply(send, this, [method, ...args]);
        actualCaptures++;
        if (mode === 'deadline') return new Promise(() => {});
        if (mode === 'closed_target') {
          await page.close();
          return Reflect.apply(send, this, [method, ...args]);
        }
        if (mode === 'persistent_unavailable' || mode === 'first_unavailable' && attempts === 1 || mode === 'other_protocol') {
          protocolError.setMessage(mode === 'other_protocol' ? 'Owned distinct protocol failure' : 'Unable to capture screenshot');
          throw protocolError;
        }
        return value;
      };
      const started = performance.now();
      let passed = false;
      let failure = 'none';
      try {
        const image = PNG.sync.read(await page.screenshot({ timeout: 5000 }));
        assert.equal(image.width, 320); assert.equal(image.height, 240);
        const offset = (100 * image.width + 100) * 4;
        assert.deepEqual([...image.data.subarray(offset, offset + 4)], [255, 0, 0, 255]);
        passed = true;
      } catch (error) {
        failure = error.name === 'TimeoutError' ? 'timeout' : error.message.includes('Unable to capture screenshot') ? 'unavailable' :
          error.message.includes('Owned distinct protocol failure') ? 'other_protocol' : /Target.*closed|Session closed/.test(error.message) ? 'closed_target' : 'unexpected';
      } finally {
        client.send = send;
        await page.close();
      }
      const elapsedMs = Math.round(performance.now() - started);
      const receipt = { mode, passed, failure, attempts, actualCaptures, elapsedMs };
      results.push(receipt);
      assert.equal(attempts, ['first_unavailable', 'persistent_unavailable'].includes(mode) ? 2 : 1, JSON.stringify(receipt));
      assert.equal(actualCaptures, attempts, JSON.stringify(receipt));
      assert.equal(passed, ['healthy', 'first_unavailable'].includes(mode), JSON.stringify(receipt));
      assert.equal(failure, ({ persistent_unavailable: 'unavailable', other_protocol: 'other_protocol', closed_target: 'closed_target', deadline: 'timeout' })[mode] ?? 'none', JSON.stringify(receipt));
      if (mode === 'deadline') assert.ok(elapsedMs < 6500, JSON.stringify(receipt));
    }
    console.log(JSON.stringify({ fixture: 'chromium_capture_recovery_calibration', engine: 'chromium', cases: results }));
  } finally { await browser.close(); }
});
