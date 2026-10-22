/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import fs from 'node:fs/promises';
import { PNG } from 'pngjs';
import { test, expect } from './fixtures';

test('original recorded WebM decodes an owned frame with the expected dimensions and pixels', async ({ startClient, server }, testInfo) => {
  server.setContent('/', `<!doctype html><style>html,body{margin:0;background:rgb(255,0,0)}</style>
    <button onclick="document.querySelector('output').textContent=String(++window.count)">Record owned click</button><output>0</output><script>window.count=0</script>`, 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--caps=devtools,unsafe'], config: {
    browser: { contextOptions: { viewport: { width: 320, height: 240 }, deviceScaleFactor: 1 } },
  } });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true); return result;
  };
  await call('browser_navigate', { url: server.PREFIX });
  const sourceFilename = testInfo.outputPath('owned-source.png');
  await call('browser_take_screenshot', { filename: sourceFilename, scale: 'css' });
  expect((await fs.stat(sourceFilename)).size).toBeLessThanOrEqual(8 * 1024 * 1024);
  const sourceBytes = await fs.readFile(sourceFilename);
  expect(sourceBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(sourceBytes.readUInt32BE(16)).toBe(320); expect(sourceBytes.readUInt32BE(20)).toBe(240);
  const source = PNG.sync.read(sourceBytes); const offset = (100 * source.width + 100) * 4;
  const pixel = [...source.data.subarray(offset, offset + 4)];
  expect(pixel[0]).toBeGreaterThanOrEqual(230); expect(pixel[1]).toBeLessThanOrEqual(20);
  expect(pixel[2]).toBeLessThanOrEqual(20); expect(pixel[3]).toBe(255);
  console.log(JSON.stringify({ fixture: 'owned_video_source_paint', width: 320, height: 240, pixel }));
  const filename = testInfo.outputPath('owned-frame.webm');
  await call('browser_start_video', { filename, fps: 10 });
  await call('browser_run_code_unsafe', { code: `async page => {
    for (let index=0;index<6;index++) await page.getByRole('button', { name:'Record owned click', exact:true }).click();
    if (await page.locator('output').textContent() !== '6') throw new Error('Owned video click count mismatch');
    return { recordedClicks:6 };
  }` });
  await call('browser_stop_video');
  const stat = await fs.stat(filename);
  expect(stat.size).toBeGreaterThan(0); expect(stat.size).toBeLessThanOrEqual(8 * 1024 * 1024);
  const recording = await fs.readFile(filename); let playbackRequests = 0;
  server.route('/owned.webm', (_request, response) => {
    playbackRequests++; response.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': recording.length }); response.end(recording);
  });
  server.setContent('/playback', `<!doctype html><title>Owned WebM playback</title>
    <video id="recording" muted preload="auto" src="/owned.webm" onloadeddata="document.querySelector('output').textContent='Owned video decoded'"></video><output>Loading</output>`, 'text/html');
  await call('browser_navigate', { url: new URL('/playback', server.PREFIX).href });
  await call('browser_run_code_unsafe', { code: `async page => {
    let readinessTimedOut=false;
    try { await page.getByText('Owned video decoded').first().waitFor({state:'visible',timeout:5000}); }
    catch(error) { if(error.name!=='TimeoutError') throw error;readinessTimedOut=true; }
    const state=await page.locator('#recording').evaluate(video=>({ready:video.readyState,network:video.networkState,error:video.error?.code??0,webm:video.canPlayType('video/webm; codecs="vp9"'),width:video.videoWidth,height:video.videoHeight}));
    if(readinessTimedOut || state.error || state.ready<2) throw new Error('Owned video readiness failed '+JSON.stringify({readinessTimedOut,...state}));
    const frame = await page.locator('#recording').evaluate(video => {
      const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
      const context=canvas.getContext('2d');context.drawImage(video,0,0);
      return { width:video.videoWidth,height:video.videoHeight,ready:video.readyState,pixel:Array.from(context.getImageData(100,100,1,1).data) };
    });
    if (frame.width!==320 || frame.height!==240 || frame.ready<2 || frame.pixel[0]<230 || frame.pixel[1]>20 || frame.pixel[2]>20 || frame.pixel[3]!==255) throw new Error('Owned decoded frame mismatch '+JSON.stringify(frame));
    return { width:frame.width,height:frame.height,decodedRedFrame:true };
  }` });
  expect(playbackRequests).toBeGreaterThan(0);
  await call('browser_close');
  console.log(JSON.stringify({ fixture: 'owned_webm_frame', width: 320, height: 240,
    recordedClicks: 6, decodedRedFrame: true, bytes: recording.length }));
});
