/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import fs from 'node:fs/promises';
import { test, expect } from './fixtures';

const tools = (client: any) => async (name: string, args: Record<string, unknown> = {}) => {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError, JSON.stringify(result)).not.toBe(true);
  return result.content.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('\n');
};
const evaluated = (text: string) => {
  const match = text.match(/^### Result\n([\s\S]*?)(?=\n### |$)/);
  expect(match, text).toBeTruthy(); return JSON.parse(match![1]);
};

test('original form fill, typing, selection, hover, viewport and history affect the owned page', async ({ startClient, server }) => {
  server.setContent('/first', `<!doctype html><title>First fixture</title><form onsubmit="event.preventDefault();document.querySelector('#submitted').textContent='submitted:'+document.querySelector('#name').value">
    <input id="name" aria-label="Name" onkeyup="this.dataset.keys=String(Number(this.dataset.keys||0)+1)">
    <input id="agree" type="checkbox" aria-label="Agree"><input id="radio" type="radio" aria-label="Radio">
    <select id="choice" aria-label="Choice"><option value="alpha">Alpha</option><option value="beta">Beta</option></select><button>Submit</button></form>
    <button id="hover" onmouseenter="document.querySelector('#hovered').textContent='hovered'">Hover fixture</button><output id="hovered">waiting</output><output id="submitted">waiting</output>`, 'text/html');
  server.setContent('/second', '<!doctype html><title>Second fixture</title><h1>Second page</h1>', 'text/html');
  const { client } = await startClient({ args: ['--isolated'] }); const call = tools(client);
  await call('browser_navigate', { url: server.PREFIX + 'first' });
  await call('browser_resize', { width: 800, height: 600 });
  expect(evaluated(await call('browser_evaluate', { function: '() => ({width:innerWidth,height:innerHeight})' }))).toEqual({ width: 800, height: 600 });
  await call('browser_fill_form', { fields: [
    { name: 'Name', target: '#name', type: 'textbox', value: 'filled-name' },
    { name: 'Agree', target: '#agree', type: 'checkbox', value: 'true' },
    { name: 'Radio', target: '#radio', type: 'radio', value: 'true' },
    { name: 'Choice', target: '#choice', type: 'combobox', value: 'Beta' },
  ] });
  expect(evaluated(await call('browser_evaluate', { function: "() => ({name:document.querySelector('#name').value,agree:document.querySelector('#agree').checked,radio:document.querySelector('#radio').checked,choice:document.querySelector('#choice').value})" }))).toEqual({ name: 'filled-name', agree: true, radio: true, choice: 'beta' });
  await call('browser_select_option', { target: '#choice', values: ['alpha'] });
  await call('browser_type', { target: '#name', text: '' });
  const initialKeys = evaluated(await call('browser_evaluate', { function: "() => Number(document.querySelector('#name').dataset.keys || 0)" }));
  await call('browser_type', { target: '#name', text: 'key', slowly: true });
  expect(evaluated(await call('browser_evaluate', { function: "() => ({value:document.querySelector('#name').value,keys:Number(document.querySelector('#name').dataset.keys),choice:document.querySelector('#choice').value})" }))).toEqual({ value: 'key', keys: initialKeys + 3, choice: 'alpha' });
  await call('browser_type', { target: '#name', text: 'final', submit: true });
  await call('browser_wait_for', { text: 'submitted:final' });
  await call('browser_hover', { target: '#hover' });
  expect(await call('browser_snapshot')).toContain('hovered');
  await call('browser_navigate', { url: server.PREFIX + 'second' });
  expect(await call('browser_navigate_back')).toContain('First fixture');
  expect(evaluated(await call('browser_evaluate', { function: '() => location.pathname' }))).toBe('/first');
  await call('browser_close');
});

test('original element drag and MIME/file drops reach only the owned drop target', async ({ startClient, server }, testInfo) => {
  server.setContent('/', `<!doctype html><style>#source,#target{width:180px;height:80px;margin:20px;background:#eee}</style>
    <div id="source" draggable="true" ondragstart="event.dataTransfer.setData('text/plain','owned-drag')">Drag fixture</div>
    <div id="target" ondragover="event.preventDefault()" ondrop="event.preventDefault();document.querySelector('output').textContent=event.dataTransfer.files.length?'file:'+event.dataTransfer.files[0].name+':'+event.dataTransfer.files[0].size:event.dataTransfer.getData('text/plain')">Drop fixture</div><output>waiting</output>`, 'text/html');
  const { client } = await startClient({ args: ['--isolated'] }); const call = tools(client);
  await call('browser_navigate', { url: server.PREFIX });
  await call('browser_drag', { startTarget: '#source', endTarget: '#target' });
  await call('browser_wait_for', { text: 'owned-drag' });
  await call('browser_drop', { target: '#target', data: { 'text/plain': 'owned-mime-drop' } });
  await call('browser_wait_for', { text: 'owned-mime-drop' });
  const filename = testInfo.outputPath('owned-drop.txt'); await fs.writeFile(filename, 'owned');
  await call('browser_drop', { target: '#target', paths: [filename] });
  await call('browser_wait_for', { text: 'file:owned-drop.txt:5' });
  expect((await client.callTool({ name: 'browser_drop', arguments: { target: '#target' } })).isError).toBe(true);
  await call('browser_close');
});

test('original coordinate drag paints a held canvas stroke and wheel scrolls the owned page', async ({ startClient, server }) => {
  server.setContent('/', `<!doctype html><style>body{margin:0;height:3000px}canvas{display:block}output{position:fixed;right:0;top:0}</style><canvas width="200" height="100"></canvas><output>waiting</output><script>
    const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),output=document.querySelector('output');let held=false,moved=false;
    canvas.onmousedown=e=>{held=true;ctx.beginPath();ctx.moveTo(e.offsetX,e.offsetY)};
    canvas.onmousemove=e=>{if(held&&(e.buttons&1)){moved=true;ctx.lineWidth=4;ctx.lineTo(e.offsetX,e.offsetY);ctx.stroke()}};
    canvas.onmouseup=()=>{held=false;output.textContent='stroke:'+moved+':'+(ctx.getImageData(50,20,1,1).data[3]===255)};
    onscroll=()=>{if(scrollY>0)output.textContent='owned-scrolled'};
  </script>`, 'text/html');
  const { client } = await startClient({ args: ['--isolated', '--caps=vision', '--image-responses=omit'] }); const call = tools(client);
  await call('browser_navigate', { url: server.PREFIX });
  await call('browser_mouse_drag_xy', { startX: 20, startY: 20, endX: 80, endY: 20 });
  expect(await call('browser_snapshot')).toContain('stroke:true:true');
  await call('browser_mouse_wheel', { deltaX: 0, deltaY: 400 });
  await call('browser_wait_for', { text: 'owned-scrolled' });
  expect(evaluated(await call('browser_evaluate', { function: '() => scrollY > 0' }))).toBe(true);
  await call('browser_close');
});
