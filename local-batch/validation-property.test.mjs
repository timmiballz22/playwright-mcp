// Deterministic JSON boundary corpus; no browser, network or untrusted code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkflow } from './runner.mjs';

test('explicit null browser is rejected consistently with the public schema', () => {
  assert.throws(() => validateWorkflow({ browser: null, steps: [{ type: 'screenshot' }] }), TypeError);
  assert.equal(validateWorkflow({ steps: [{ type: 'screenshot' }] }).browser, 'chromium');
});

test('seeded valid workflows preserve action bounds and Unicode without changing input', () => {
  let seed = 0x4d435031;
  const random = max => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) % max; };
  const types = ['goto', 'assertURL', 'click', 'fill', 'press', 'check', 'uncheck', 'hover', 'waitFor', 'assertText', 'scroll', 'screenshot'];
  const seenTypes = new Set();
  const strings = ['button', 'مرحبا', '日本語', 'e\u0301', '😀', '\u202Elabel'];
  for (let sample = 0; sample < 500; sample++) {
    const iterations = random(100) + 1; const repeat = random(Math.floor(1000 / iterations)) + 1;
    const type = types[random(types.length)]; seenTypes.add(type); const text = strings[random(strings.length)];
    const step = { type, repeat };
    if (['goto', 'assertURL'].includes(type)) step.url = 'http://127.0.0.1:12345/';
    else if (type === 'scroll') { step.deltaX = random(20001) - 10000; step.deltaY = random(20001) - 10000; }
    else if (type !== 'screenshot') {
      step.selector = sample % 2 ? { role: 'button', name: text } : { testId: text };
      if (type === 'fill') step.value = sample % 3 ? text : '';
      if (type === 'press') step.key = 'Enter';
      if (type === 'assertText') step.equals = text;
    }
    const input = { schemaVersion: 1, browser: ['chromium', 'firefox', 'webkit'][random(3)], iterations, steps: [step] };
    const encoded = JSON.stringify(input); const result = validateWorkflow(input);
    assert.equal(JSON.stringify(input), encoded);
    assert.equal(result.steps.length, repeat); assert.equal(result.iterations, iterations);
    assert.ok(result.steps.length * result.iterations <= 1000);
    const expected = { ...step }; delete expected.repeat;
    for (const action of result.steps) assert.deepEqual(action, expected);
  }
  assert.deepEqual([...seenTypes].sort(), [...types].sort());
});

test('JSON mutation corpus rejects unknown fields, wrong types and expansion overflow', () => {
  const base = { steps: [{ type: 'click', selector: { role: 'button', name: 'Add' } }] };
  let cases = 0;
  const reject = input => { assert.throws(() => validateWorkflow(JSON.parse(JSON.stringify(input))), TypeError); cases++; };
  for (const field of ['__proto__', 'constructor', 'prototype', 'allowedOrigins', 'shell', 'code', 'profile', 'maxScreenshotBytes']) {
    reject({ ...base, [field]: 'canary' });
    reject({ steps: [{ ...base.steps[0], [field]: 'canary' }] });
    reject({ steps: [{ type: 'click', selector: { role: 'button', name: 'Add', [field]: 'canary' } }] });
  }
  for (const browser of [null, false, 0, [], {}, 'Firefox', 'chromium\0']) reject({ ...base, browser });
  for (const field of ['iterations', 'timeoutMs', 'actionTimeoutMs'])
    for (const value of [null, false, '100', [], {}, -1, 0, 0.5, 180001]) reject({ ...base, [field]: value });
  for (const value of [null, false, '', [], {}, 0]) reject({ steps: [{ type: 'click', selector: value }] });
  for (const repeat of [null, false, '1', 0, -1, 0.1, 1001]) reject({ steps: [{ ...base.steps[0], repeat }] });
  for (let iterations = 2; iterations <= 100; iterations++)
    reject({ iterations, steps: [{ ...base.steps[0], repeat: Math.floor(1000 / iterations) + 1 }] });
  assert.equal(cases, 170);
});
