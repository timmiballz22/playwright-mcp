import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWorkflow, validateWorkflow } from './runner.mjs';

function makeFake({ failAt = -1 } = {}) {
  const state = { clicks: 0, closes: 0, contextsClosed: 0, url: 'about:blank', routes: [] };
  const page = {
    goto: async url => { state.url = url; },
    url: () => state.url,
    mouse: { wheel: async () => {} },
    locator: selector => ({
      click: async () => {
        state.clicks++;
        if (state.clicks === failAt) throw new Error('internal sensitive credential=never-leak');
      },
      fill: async () => {},
      press: async () => {},
      check: async () => {},
      uncheck: async () => {},
      hover: async () => {},
      waitFor: async () => {},
      textContent: async () => String(state.clicks),
    }),
    screenshot: async () => {},
  };
  const context = {
    setDefaultTimeout: () => {},
    setDefaultNavigationTimeout: () => {},
    route: async (pattern, fn) => { state.routes.push({ pattern, fn }); },
    newPage: async () => page,
    close: async () => { state.contextsClosed++; },
  };
  const browser = {
    newContext: async () => context,
    close: async () => { state.closes++; },
  };
  return { state, playwright: { chromium: { launch: async () => browser } } };
}

test('rejects unknown instructions, unbounded workloads and hostile origins', async () => {
  assert.throws(() => validateWorkflow({ steps: [{ type: 'eval', code: 'evil()' }] }));
  assert.throws(() => validateWorkflow({ steps: [{ type: 'click', selector: '#x' }], iterations: 101 }));
  assert.throws(() => validateWorkflow({ steps: Array(11).fill({ type: 'click', selector: '#x' }), iterations: 100 }));
  const mock = makeFake();
  await assert.rejects(runWorkflow({ steps: [{ type: 'goto', url: 'file:///etc/passwd' }] }, mock));
  await assert.rejects(runWorkflow({ steps: [{ type: 'goto', url: 'https://example.org/' }] }, mock));
  await assert.rejects(runWorkflow({ steps: [{ type: 'goto', url: 'http://user:secret@localhost/' }] }, mock));
  assert.equal(mock.state.closes, 0);
});

test('100 ordered actions finish in a single batch with one browser launch', async () => {
  const { state, playwright } = makeFake();
  const result = await runWorkflow({
    iterations: 100,
    steps: [{ type: 'click', selector: '#increase' }],
  }, { playwright });
  assert.equal(result.ok, true);
  assert.equal(result.completed, 100);
  assert.deepEqual(result.results.map(x => x.index), Array.from({ length: 100 }, (_, i) => i + 1));
  assert.equal(state.clicks, 100);
  assert.equal(state.closes, 1);
  assert.equal(state.contextsClosed, 1);
});

test('failures stop promptly, hide underlying sensitive errors and clean up', async () => {
  const { state, playwright } = makeFake({ failAt: 3 });
  const result = await runWorkflow({
    steps: Array.from({ length: 8 }, () => ({ type: 'click', selector: '#x' })),
  }, { playwright });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'action_failed');
  assert.equal(result.completed, 2);
  assert.equal(result.results.length, 3);
  assert.equal(JSON.stringify(result).includes('credential='), false);
  assert.equal(state.contextsClosed, 1);
  assert.equal(state.closes, 1);
});

test('cancellation before starting avoids launching browser', async () => {
  const controller = new AbortController();
  controller.abort();
  const { state, playwright } = makeFake();
  const result = await runWorkflow({ steps: [{ type: 'click', selector: '#x' }] },
    { playwright, signal: controller.signal });
  assert.equal(result.reason, 'cancelled');
  assert.equal(state.closes, 0);
});

test('checks target origins and reports assertion failure without page content', async () => {
  const { state, playwright } = makeFake();
  const result = await runWorkflow({
    steps: [
      { type: 'goto', url: 'https://example.com/page' },
      { type: 'assertURL', url: 'https://example.com/page' },
      { type: 'assertText', selector: 'body', contains: 'unexpected-secret' },
    ],
  }, { playwright, allowedOrigins: ['https://example.com'] });
  assert.equal(result.completed, 2);
  assert.equal(result.reason, 'action_failed');
  assert.equal(state.routes.length, 1);
  assert.equal(state.closes, 1);
});

test('unknown localhost ports require exact operator origins', async () => {
  const mock = makeFake();
  for (const url of ['http://localhost:3456/', 'http://127.0.0.1:3456/', 'http://[::1]:3456/'])
    await assert.rejects(runWorkflow({ steps: [{ type: 'goto', url }] }, mock));
  const result = await runWorkflow({ steps: [{ type: 'goto', url: 'http://localhost:3456/' }] },
    { ...mock, allowedOrigins: ['http://localhost:3456'] });
  assert.equal(result.ok, true);
});

test('rejects extra workflow and action properties rather than ignoring policy', () => {
  assert.throws(() => validateWorkflow({ steps: [{ type: 'click', selector: 'button' }], allowedOrigins: ['http://localhost'] }));
  assert.throws(() => validateWorkflow({ steps: [{ type: 'click', selector: 'button', code: 'canary' }] }));
  assert.throws(() => validateWorkflow({ steps: [{ type: 'screenshot', value: 'canary' }] }));
});

test('deadline includes a stalled launch and closes late browser', async () => {
  let closed = 0;
  const result = await runWorkflow({ timeoutMs: 100, steps: [{ type: 'click', selector: 'button' }] }, {
    playwright: { chromium: { launch: () => new Promise(resolve => setTimeout(() => resolve({ close: async () => { closed++; } }), 150)) } },
  });
  assert.equal(result.reason, 'timeout');
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(closed, 1);
});

test('validation snapshots actions before asynchronous launch', async () => {
  const step = { type: 'goto', url: 'https://example.com/' };
  const { state, playwright } = makeFake();
  const pending = runWorkflow({ steps: [step] }, { playwright, allowedOrigins: ['https://example.com'] });
  step.url = 'file:///etc/passwd';
  const result = await pending;
  assert.equal(result.ok, true);
  assert.equal(state.url, 'https://example.com/');
});

test('screenshot capture requires operator approval for sensitive artifacts', async () => {
  await assert.rejects(runWorkflow({ steps: [{ type: 'screenshot' }] }, makeFake()), /Sensitive artifact capture/);
});

test('workflow version and serialized size are bounded', () => {
  assert.throws(() => validateWorkflow({ schemaVersion: 2, steps: [{ type: 'screenshot' }] }));
  assert.doesNotThrow(() => validateWorkflow({ schemaVersion: 1, steps: [{ type: 'screenshot' }] }));
  assert.throws(() => validateWorkflow({ steps: Array.from({ length: 200 }, () => ({ type: 'fill', selector: 'input', value: 'x'.repeat(10000) })) }));
});

test('accessible selectors validate exact shape and clone nested values', () => {
  const selector = { role: 'button', name: 'Save' };
  const result = validateWorkflow({ steps: [{ type: 'click', selector }] });
  selector.name = 'Mutated';
  assert.equal(result.steps[0].selector.name, 'Save');
  assert.throws(() => validateWorkflow({ steps: [{ type: 'click', selector: { role: 'button', name: 'Save', code: 'secret' } }] }));
});

test('explicit action repeats expand within the total action cap', async () => {
  const fake = makeFake();
  const result = await runWorkflow({ schemaVersion: 1, steps: [{ type: 'click', selector: 'button', repeat: 1000 }] }, fake);
  assert.equal(result.completed, 1000);
  assert.equal(fake.state.clicks, 1000);
  assert.equal(fake.state.closes, 1);
  assert.throws(() => validateWorkflow({ steps: [{ type: 'click', selector: 'button', repeat: 600 }, { type: 'click', selector: 'button', repeat: 600 }] }));
  assert.throws(() => validateWorkflow({ steps: [{ type: 'click', selector: 'button', repeat: 0 }] }));
  assert.throws(() => validateWorkflow({ iterations: 2, steps: [{ type: 'click', selector: 'button', repeat: 600 }] }));
});

test('text equality rejects duplicate counters and ambiguous expectations', async () => {
  const fake = makeFake();
  const result = await runWorkflow({ steps: [{ type: 'click', selector: 'button', repeat: 10 }, { type: 'assertText', selector: 'output', equals: '1' }] }, fake);
  assert.equal(result.ok, false);
  assert.equal(result.completed, 10);
  assert.throws(() => validateWorkflow({ steps: [{ type: 'assertText', selector: 'output', equals: '1', contains: '1' }] }));
});
