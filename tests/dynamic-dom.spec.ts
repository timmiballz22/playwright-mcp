/** Copyright 2026 contributors. Licensed under Apache-2.0. */
import { test, expect } from './fixtures';

test('original snapshot references cross nested open shadow roots and activate exactly once', async ({ startClient, server }) => {
  server.setContent('/', `<!doctype html><title>Owned nested shadow</title><div id="host"></div><output>Waiting</output><script>
    const outer=document.querySelector('#host').attachShadow({mode:'open'});
    const inner=document.createElement('div');outer.append(inner);
    const deep=inner.attachShadow({mode:'open'}),button=document.createElement('button');
    button.textContent='Deep Save ✓';button.onclick=()=>document.querySelector('output').textContent='Сохранено ✓:'+String(++window.count);deep.append(button);
    window.count=0;
  </script>`, 'text/html; charset=utf-8');
  const { client } = await startClient({ args: ['--isolated'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  };
  await call('browser_navigate', { url: server.PREFIX });
  const snapshot = await call('browser_snapshot');
  const reference = snapshot.match(/button "Deep Save ✓" \[ref=([^\]]+)\]/);
  expect(reference, snapshot).toBeTruthy();
  await call('browser_click', { target: reference![1] });
  const after = await call('browser_snapshot');
  expect(after).toContain('Сохранено ✓:1'); expect(after).not.toContain('Сохранено ✓:2');
  await call('browser_close');
});

test('original wheel input materializes virtual rows and detached references cannot trigger duplicate effects', async ({ startClient, server }) => {
  server.setContent('/', `<!doctype html><title>Owned virtual rows</title><style>
    body{margin:0}#list{position:absolute;top:80px;left:0;width:320px;height:160px;overflow:auto}
    #spacer{height:1000px;position:relative}#rows{position:absolute;top:0}button{display:block;height:28px}
    </style><output id="window">Window 0</output><output id="effect">No effects</output>
    <div id="list" role="region" aria-label="Virtual list"><div id="spacer"><div id="rows"></div></div></div><script>
    let start=0,count=0;const list=document.querySelector('#list'),rows=document.querySelector('#rows');
    function render(){rows.replaceChildren();for(let n=start;n<start+20;n++){const b=document.createElement('button');b.textContent='Row '+String(n).padStart(4,'0');b.onclick=()=>document.querySelector('#effect').textContent='Activated row'+n+':'+String(++count);rows.append(b)}}
    render();list.addEventListener('scroll',()=>{if(start===0&&list.scrollTop>=40){start=380;rows.style.top=list.scrollTop+'px';render();document.querySelector('#window').textContent='Window 380'}});
  </script>`, 'text/html; charset=utf-8');
  const { client } = await startClient({ args: ['--isolated', '--caps=vision'], config: {
    browser: { contextOptions: { viewport: { width: 640, height: 480 } } },
  } });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  };
  await call('browser_navigate', { url: server.PREFIX });
  const initial = await call('browser_snapshot');
  expect(initial.match(/button "Row \d+"/g)).toHaveLength(20);
  expect(initial).not.toContain('Row 0399');
  const old = initial.match(/button "Row 0000" \[ref=([^\]]+)\]/);
  expect(old, initial).toBeTruthy();
  await call('browser_mouse_move_xy', { x: 100, y: 150 });
  await call('browser_mouse_wheel', { deltaX: 0, deltaY: 300 });
  await call('browser_wait_for', { text: 'Window 380' });
  const replaced = await call('browser_snapshot');
  expect(replaced.match(/button "Row \d+"/g)).toHaveLength(20);
  expect(replaced).not.toContain('Row 0000');
  const last = (await call('browser_find', { text: 'Row 0399', maxResults: 1 })).match(/button "Row 0399" \[ref=([^\]]+)\]/);
  expect(last).toBeTruthy();
  await call('browser_click', { target: last![1] });
  expect(await call('browser_snapshot')).toContain('Activated row399:1');
  const stale = await client.callTool({ name: 'browser_click', arguments: { target: old![1] } });
  expect(stale.isError, JSON.stringify(stale)).toBe(true);
  const final = await call('browser_snapshot');
  expect(final).toContain('Activated row399:1'); expect(final).not.toContain(':2');
  await call('browser_close');
  console.log(JSON.stringify({ fixture: 'owned_virtual_rows', totalRows: 400, renderedRows: 20,
    finalRow: 399, confirmedEffects: 1, detachedReferenceRejected: true }));
});

test('original disabled snapshot reference remains actionable after gated hydration without duplicate effects', async ({ startClient, server }) => {
  let releaseHydration!: () => void;
  let effectHits = 0;
  const hydrationRequested = new Promise<void>(resolve => {
    server.route('/hydrate', (_request, response) => {
      releaseHydration = () => response.end('ready');
      resolve();
    });
  });
  server.route('/effect', (request, response) => {
    expect(request.method).toBe('POST');
    effectHits++;
    response.end('ok');
  });
  server.setContent('/', `<!doctype html><title>Owned hydration</title>
    <button disabled>Hydrated Save</button><output>Hydration pending</output><script>
    const button=document.querySelector('button'),output=document.querySelector('output');
    let effects=0;
    fetch('/hydrate').then(r=>r.text()).then(()=>{
      button.onclick=()=>{output.textContent='Saved:'+String(++effects);fetch('/effect',{method:'POST'})};
      output.textContent='Hydration ready';button.disabled=false;
    });
  </script>`, 'text/html; charset=utf-8');
  const { client } = await startClient({ args: ['--isolated'] });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    return result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  };
  try {
    await call('browser_navigate', { url: server.PREFIX });
    await hydrationRequested;
    const initial = await call('browser_snapshot');
    expect(initial).toContain('Hydration pending');
    const reference = initial.match(/button "Hydrated Save" \[disabled\] \[ref=([^\]]+)\]/);
    expect(reference, initial).toBeTruthy();
    expect(effectHits).toBe(0);
    releaseHydration();
    await call('browser_wait_for', { text: 'Hydration ready' });
    const effect = server.waitForRequest('/effect');
    void effect.catch(() => {});
    await call('browser_click', { target: reference![1] });
    await effect;
    const final = await call('browser_snapshot');
    expect(final).toContain('Saved:1'); expect(final).not.toContain('Saved:2');
    expect(effectHits).toBe(1);
    await call('browser_close');
    console.log(JSON.stringify({ fixture: 'owned_gated_hydration', initiallyDisabled: true,
      originalReferenceUsed: true, confirmedPostEffects: effectHits }));
  } finally {
    releaseHydration?.();
  }
});
