/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import { errors } from 'playwright';
import { PNG } from 'pngjs';
import { test as originalTest, expect } from './fixtures';
import { ownedPcmWave } from './fixtures/owned-pcm.mjs';
import { serveMedia } from './fixtures/media-response.mjs';

// Only this reference uses the test runner's owned stock-browser fixture.
// Preserve each project's existing engine/channel; no MCP launch option changes.
const test = originalTest.extend<{}, { browserName: 'chromium' | 'firefox' | 'webkit', channel: string | undefined }>({
  browserName: [async ({}, use, workerInfo) => {
    const name = workerInfo.project.name;
    if (!['chrome', 'chromium', 'firefox', 'webkit'].includes(name)) throw new Error('Unsupported stock media reference project');
    await use(name === 'firefox' || name === 'webkit' ? name : 'chromium');
  }, { scope: 'worker' }],
  channel: [async ({}, use, workerInfo) => { await use(workerInfo.project.name === 'chrome' ? 'chrome' : undefined); }, { scope: 'worker' }],
});

test('stock API PCM reference records preload and owned user activation independently', async ({ page, server }, testInfo) => {
  const audio = ownedPcmWave(); let mediaRequests = 0, partialResponses = 0;
  server.route('/stock-tone.wav', (request, response) => {
    mediaRequests++; serveMedia(request, response, audio, 'audio/wav');
    if (response.statusCode === 206) partialResponses++;
  });
  server.setContent('/', `<!doctype html><title>Owned stock PCM reference</title>
    <audio id="player" src="/stock-tone.wav" preload="auto" muted loop></audio>
    <button onclick="const audio=document.querySelector('audio');audio.play().then(()=>{this.dataset.play='fulfilled'},error=>{this.dataset.play='rejected';this.dataset.error=['NotSupportedError','NotAllowedError','AbortError'].includes(error.name)?error.name:'other'})">Play owned reference</button>`, 'text/html');
  await page.goto(server.PREFIX, { waitUntil: 'domcontentloaded', timeout: 10000 });
  const observe = async () => page.locator('#player').evaluate((audio: HTMLAudioElement) => ({
    ready: audio.readyState, network: audio.networkState, error: audio.error?.code ?? 0,
    paused: audio.paused, muted: audio.muted, currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : null,
    duration: Number.isFinite(audio.duration) ? audio.duration : null, wav: audio.canPlayType('audio/wav'),
  }));
  let preloadTimedOut = false, activationTimedOut = false;
  try { await page.waitForFunction(() => (document.querySelector('audio') as HTMLAudioElement).readyState >= 2, undefined, { timeout: 5000 }); }
  catch (error) { if (!(error instanceof errors.TimeoutError)) throw error; preloadTimedOut = true; }
  const preload = await observe();
  await page.getByRole('button', { name: 'Play owned reference', exact: true }).click({ timeout: 5000 });
  try { await page.waitForFunction(() => { const audio = document.querySelector('audio') as HTMLAudioElement; return !audio.paused && audio.currentTime > 0.05; }, undefined, { timeout: 5000 }); }
  catch (error) { if (!(error instanceof errors.TimeoutError)) throw error; activationTimedOut = true; }
  const activated = await observe();
  const play = await page.getByRole('button', { name: 'Play owned reference', exact: true }).evaluate(button => ({
    result: ['fulfilled', 'rejected'].includes(button.dataset.play ?? '') ? button.dataset.play : 'pending',
    error: ['NotSupportedError', 'NotAllowedError', 'AbortError', 'other'].includes(button.dataset.error ?? '') ? button.dataset.error : 'none',
  }));
  console.log(JSON.stringify({ fixture: 'stock_pcm_reference', api: 'stock_playwright', project: testInfo.project.name,
    engine: page.context().browser()?.browserType().name() ?? 'unknown',
    mediaRequests, partialResponses, requestCountsAreLowerBounds: true, preloadTimedOut, preload, activationTimedOut, activated, play }));
  // Both observations are retained even if preload fails. A later successful
  // activation cannot turn the separate original/MCP preload failure into PASS.
  expect(preloadTimedOut).toBe(false); expect(preload.ready).toBeGreaterThanOrEqual(2);
  expect(preload.paused).toBe(true); expect(preload.muted).toBe(true);
  expect(preload.duration).toBeGreaterThanOrEqual(1.9); expect(preload.duration).toBeLessThanOrEqual(2.1);
  expect(activationTimedOut).toBe(false); expect(play.result).toBe('fulfilled');
  expect(activated.currentTime).toBeGreaterThan(0.05); expect(activated.muted).toBe(true);
});

test('stock API screenshot reference captures an owned red viewport', async ({ page, server }, testInfo) => {
  server.setContent('/', '<!doctype html><title>Owned stock screenshot</title><style>html,body{margin:0;width:100%;height:100%;background:rgb(255,0,0)}</style>', 'text/html');
  await page.setViewportSize({ width: 320, height: 240 });
  await page.goto(server.PREFIX, { waitUntil: 'domcontentloaded', timeout: 10000 });
  const started = performance.now();
  let bytes: Buffer;
  try { bytes = await page.screenshot({ type: 'png', timeout: 5000 }); }
  catch (error) {
    console.log(JSON.stringify({ fixture: 'stock_screenshot_reference', api: 'stock_playwright', project: testInfo.project.name,
      engine: page.context().browser()?.browserType().name() ?? 'unknown', captured: false,
      failure: error instanceof Error && error.message.includes('Unable to capture screenshot') ? 'capture_unavailable' : 'other',
      durationMs: Math.round(performance.now() - started) }));
    throw error;
  }
  expect(bytes.length).toBeLessThanOrEqual(1048576);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.readUInt32BE(16)).toBe(320); expect(bytes.readUInt32BE(20)).toBe(240);
  const image = PNG.sync.read(bytes); const offset = (100 * image.width + 100) * 4;
  const pixel = [...image.data.subarray(offset, offset + 4)];
  console.log(JSON.stringify({ fixture: 'stock_screenshot_reference', api: 'stock_playwright', project: testInfo.project.name,
    engine: page.context().browser()?.browserType().name() ?? 'unknown', captured: true,
    width: image.width, height: image.height, pixel, bytes: bytes.length, durationMs: Math.round(performance.now() - started) }));
  expect(pixel[0]).toBeGreaterThanOrEqual(230); expect(pixel[1]).toBeLessThanOrEqual(20);
  expect(pixel[2]).toBeLessThanOrEqual(20); expect(pixel[3]).toBe(255);
});
