/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import { test, expect } from './fixtures';

// Generated PCM avoids external assets, codec downloads and microphone access.
function wave() {
  const rate = 8000; const frames = rate * 2;
  const bytes = Buffer.alloc(44 + frames * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(frames * 2, 40);
  for (let index = 0; index < frames; index++)
    bytes.writeInt16LE(Math.round(Math.sin(index * Math.PI * 2 * 440 / rate) * 2048), 44 + index * 2);
  return bytes;
}

test('original muted PCM media advances, pauses and reports a missing media source', async ({ startClient, server }) => {
  const audio = wave(); let mediaRequests = 0; let missingRequests = 0;
  server.route('/tone.wav', (_request, response) => {
    mediaRequests++; response.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': audio.length }); response.end(audio);
  });
  server.route('/missing.wav', (_request, response) => {
    missingRequests++; response.writeHead(404, { 'Content-Type': 'audio/wav' }); response.end();
  });
  server.setContent('/', `<!doctype html><title>Owned media fixture</title>
    <audio id="player" src="/tone.wav" preload="auto" muted loop oncanplay="document.querySelector('#ready').textContent='Media ready'"></audio>
    <button id="play" onclick="document.querySelector('audio').play().then(()=>document.querySelector('#state').textContent='Playing',()=>document.querySelector('#state').textContent='Play rejected')">Play owned media</button>
    <button id="pause" onclick="document.querySelector('audio').pause();document.querySelector('#state').textContent='Paused'">Pause owned media</button>
    <output id="ready">Loading</output><output id="state">Not started</output>`, 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--caps=unsafe'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true); return result;
  };
  await call('browser_navigate', { url: server.PREFIX });
  await call('browser_wait_for', { text: 'Media ready' });
  await call('browser_run_code_unsafe', { code: `async page => {
    const initial = await page.locator('#player').evaluate(audio => ({ paused: audio.paused, muted: audio.muted, duration: audio.duration, ready: audio.readyState }));
    if (!initial.paused || !initial.muted || initial.duration !== 2 || initial.ready < 2) throw new Error('Owned media initial state mismatch');
    return { initialStateVerified: true };
  }` });
  await call('browser_click', { target: '#play' });
  await call('browser_wait_for', { text: 'Playing' });
  await call('browser_run_code_unsafe', { code: `async page => {
    await page.waitForFunction(() => { const audio = document.querySelector('#player'); return !audio.paused && audio.currentTime > 0.05; }, undefined, { timeout: 3000 });
    return { mediaAdvanced: true };
  }` });
  await call('browser_click', { target: '#pause' });
  await call('browser_run_code_unsafe', { code: `async page => {
    const paused = await page.locator('#player').evaluate(audio => audio.paused);
    if (!paused) throw new Error('Owned media pause mismatch');
    const failure = await page.evaluate(() => new Promise(resolve => {
      const broken = document.createElement('audio');
      broken.addEventListener('error', () => resolve({ code: broken.error.code, state: broken.networkState }), { once: true });
      broken.src = '/missing.wav'; document.body.append(broken); broken.load();
    }));
    if (failure.code !== 4 || failure.state !== 3) throw new Error('Owned media loading error mismatch');
    return { pauseVerified: true, missingMediaCode: failure.code, missingMediaNetworkState: failure.state };
  }` });
  expect(mediaRequests).toBeGreaterThan(0); expect(missingRequests).toBe(1);
  await call('browser_close');
  console.log(JSON.stringify({ fixture: 'owned_pcm_media', durationSeconds: 2, initialPaused: true,
    mutedPlaybackAdvanced: true, explicitPause: true, missingMediaCode: 4, missingMediaRequests: missingRequests }));
});
