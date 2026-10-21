/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import { test, expect } from './fixtures';

test('original held pointer paints canvas and repeated keyboard chords release modifiers', async ({ startClient, server }) => {
  server.setContent('/', `<!doctype html><style>body{margin:0}canvas{display:block}textarea{display:block}</style>
    <canvas width="200" height="100" aria-label="Drawing surface"></canvas><output id="pointer">pointer-waiting</output>
    <textarea id="keys">abcd</textarea><button id="focus">Focus keys</button><output id="keyboard">keyboard-waiting</output>
    <script>
      const canvas=document.querySelector('canvas'),context=canvas.getContext('2d'),pointer=document.querySelector('#pointer');
      let held=false,moved=false,releases=0;
      const render=()=>pointer.textContent='pointer-held:'+held+'; moved-held:'+moved+'; releases:'+releases+'; ink:'+(context.getImageData(50,20,1,1).data[3]===255);
      canvas.onmousedown=event=>{held=true;context.beginPath();context.moveTo(event.offsetX,event.offsetY);render()};
      canvas.onmousemove=event=>{if(held&&(event.buttons&1)){moved=true;context.lineWidth=4;context.lineTo(event.offsetX,event.offsetY);context.stroke();render()}};
      canvas.onmouseup=()=>{held=false;releases++;render()};
      const keys=document.querySelector('#keys'),keyboard=document.querySelector('#keyboard'),pressed=new Set();let downs=0,ups=0;
      document.querySelector('#focus').onclick=()=>{keys.focus();keys.setSelectionRange(0,0)};
      keys.onkeydown=event=>{pressed.add(event.key);downs++};
      keys.onkeyup=event=>{pressed.delete(event.key);ups++;keyboard.textContent='keys-down:'+downs+'; keys-up:'+ups+'; held-keys:'+pressed.size+'; selection:'+keys.selectionStart+'-'+keys.selectionEnd};
    </script>`, 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--caps=vision', '--image-responses=omit'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return JSON.stringify(result.content);
  };
  await call('browser_navigate', { url: server.PREFIX });
  await call('browser_mouse_move_xy', { x: 20, y: 20 });
  await call('browser_mouse_down', { button: 'left' });
  await call('browser_mouse_move_xy', { x: 80, y: 20 });
  expect(await call('browser_snapshot')).toContain('pointer-held:true; moved-held:true; releases:0; ink:true');
  await call('browser_mouse_up', { button: 'left' });
  expect(await call('browser_snapshot')).toContain('pointer-held:false; moved-held:true; releases:1; ink:true');
  await call('browser_click', { target: '#focus' });
  await call('browser_press_key', { key: 'ArrowRight' });
  await call('browser_press_key', { key: 'ArrowRight' });
  await call('browser_press_key', { key: 'Shift+ArrowRight' });
  expect(await call('browser_snapshot')).toContain('keys-down:4; keys-up:4; held-keys:0; selection:2-3');
  await call('browser_close');
});
