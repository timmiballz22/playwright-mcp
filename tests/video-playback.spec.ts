/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import fs from 'node:fs/promises';
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
  await call('browser_wait_for', { text: 'Owned video decoded' });
  await call('browser_run_code_unsafe', { code: `async page => {
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
