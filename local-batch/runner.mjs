// Local-only, declarative Playwright workflow engine. No shell execution or arbitrary JS evaluation.
// Copyright 2026 contributors. Licensed under Apache-2.0, see ../LICENSE.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

export const MAX_STEPS = 1000;
export const MAX_ITERATIONS = 100;
const TYPES = new Set(['goto', 'click', 'fill', 'press', 'check', 'uncheck',
  'hover', 'waitFor', 'assertText', 'assertURL', 'scroll', 'screenshot']);
const SELECTOR_TYPES = new Set(['click', 'fill', 'press', 'check', 'uncheck',
  'hover', 'waitFor', 'assertText']);
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const MAX_DURATION_MS = 180000;

function asString(value, label, max = 4096) {
  if (typeof value !== 'string' || !value.length || value.length > max)
    throw new TypeError(label + ' must be a non-empty string of at most ' + max + ' characters');
  return value;
}

function integer(value, label, min, max, fallback) {
  if (value === undefined)
    return fallback;
  if (!Number.isInteger(value) || value < min || value > max)
    throw new TypeError(label + ' must be an integer in [' + min + ', ' + max + ']');
  return value;
}

export function validateWorkflow(workflow) {
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow))
    throw new TypeError('Workflow must be an object');
  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0)
    throw new TypeError('Workflow requires a nonempty steps array');
  const iterations = integer(workflow.iterations, 'iterations', 1, MAX_ITERATIONS, 1);
  if (workflow.steps.length * iterations > MAX_STEPS)
    throw new TypeError('Workflow exceeds ' + MAX_STEPS + ' total actions');
  const browser = workflow.browser ?? 'chromium';
  if (!['chromium', 'firefox', 'webkit'].includes(browser))
    throw new TypeError('Unsupported browser');
  const timeoutMs = integer(workflow.timeoutMs, 'timeoutMs', 100, MAX_DURATION_MS, 120000);
  const actionTimeoutMs = integer(workflow.actionTimeoutMs, 'actionTimeoutMs', 100, 30000, 5000);
  const steps = workflow.steps.map((step, i) => {
    if (!step || typeof step !== 'object' || Array.isArray(step) || !TYPES.has(step.type))
      throw new TypeError('Invalid action type at step ' + i);
    if (SELECTOR_TYPES.has(step.type))
      asString(step.selector, 'step ' + i + ' selector', 500);
    if (step.type === 'goto' || step.type === 'assertURL')
      asString(step.url, 'step ' + i + ' url', 2000);
    if (step.type === 'fill' && (typeof step.value !== 'string' || step.value.length > 10000))
      throw new TypeError('step ' + i + ' value must be a string of at most 10000 characters');
    if (step.type === 'press')
      asString(step.key, 'step ' + i + ' key', 100);
    if (step.type === 'assertText')
      asString(step.contains, 'step ' + i + ' contains', 2000);
    if (step.type === 'scroll') {
      integer(step.deltaY, 'deltaY', -10000, 10000, 0);
      integer(step.deltaX, 'deltaX', -10000, 10000, 0);
    }
    return step;
  });
  return { browser, timeoutMs, actionTimeoutMs, iterations, steps };
}

function parseOrigins(allowedOrigins) {
  if (!Array.isArray(allowedOrigins))
    throw new TypeError('allowedOrigins must be an array');
  return new Set(allowedOrigins.map(origin => {
    const parsed = new URL(origin);
    if (!['https:', 'http:'].includes(parsed.protocol) ||
        parsed.username || parsed.password || parsed.pathname !== '/' ||
        parsed.search || parsed.hash)
      throw new TypeError('Allowed origins must be exact http(s) origins');
    return parsed.origin;
  }));
}

function allowedAddress(raw, allowed) {
  let url;
  try { url = new URL(raw); } catch { return false; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    return false;
  return (url.protocol === 'http:' && LOOPBACK.has(url.hostname)) || allowed.has(url.origin);
}

async function perform(page, step, index, artifactsDir) {
  const locator = step.selector ? page.locator(step.selector) : undefined;
  switch (step.type) {
    case 'goto': await page.goto(step.url, { waitUntil: 'domcontentloaded' }); break;
    case 'click': await locator.click(); break;
    case 'fill': await locator.fill(step.value); break;
    case 'press': await locator.press(step.key); break;
    case 'check': await locator.check(); break;
    case 'uncheck': await locator.uncheck(); break;
    case 'hover': await locator.hover(); break;
    case 'waitFor': await locator.waitFor({ state: 'visible' }); break;
    case 'assertText': {
      const text = await locator.textContent();
      if (!text?.includes(step.contains))
        throw new Error('Text assertion failed');
      break;
    }
    case 'assertURL':
      if (page.url() !== step.url)
        throw new Error('URL assertion failed');
      break;
    case 'scroll':
      await page.mouse.wheel(step.deltaX ?? 0, step.deltaY ?? 0);
      break;
    case 'screenshot': {
      await mkdir(artifactsDir, { recursive: true, mode: 0o700 });
      const target = path.join(artifactsDir, 'step-' + String(index).padStart(4, '0') + '.png');
      await page.screenshot({ path: target, fullPage: false });
      return { artifact: target };
    }
    default: throw new Error('Unreachable action');
  }
  return {};
}

/**
 * Executes a bounded workflow in one browser/context. No persistent cookies or profiles by default.
 * The Playwright parameter is injectable for deterministic offline tests.
 * allowedOrigins is LOCAL PROCESS configuration, never passed through MCP tool input.
 */
export async function runWorkflow(workflow, {
  playwright: suppliedPlaywright,
  allowedOrigins = [],
  artifactsDir = path.resolve('.local-batch-output'),
  signal,
} = {}) {
  const spec = validateWorkflow(workflow);
  const allowed = parseOrigins(allowedOrigins);
  for (const step of spec.steps) {
    if ((step.type === 'goto' || step.type === 'assertURL') && !allowedAddress(step.url, allowed))
      throw new TypeError('Navigation origin is not approved; configure allowed origins locally');
  }
  if (signal?.aborted)
    return { ok: false, reason: 'cancelled', completed: 0, results: [] };

  const started = performance.now();
  const playwright = suppliedPlaywright ?? await import('playwright');
  const browser = await playwright[spec.browser].launch({ headless: true });
  let context;
  let cancelled = false;
  let timedOut = false;
  let cleanupFailed = false;
  let timer;
  let abortListener;
  const results = [];
  try {
    context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block' });
    context.setDefaultTimeout(spec.actionTimeoutMs);
    context.setDefaultNavigationTimeout(Math.min(30000, spec.timeoutMs));

    // Restrict ALL browser requests, including redirects and subresources.
    await context.route('**/*', route => {
      if (allowedAddress(route.request().url(), allowed))
        return route.continue();
      return route.abort('blockedbyclient');
    });

    abortListener = () => {
      cancelled = true;
      void context.close().catch(() => {});
    };
    signal?.addEventListener('abort', abortListener, { once: true });
    timer = setTimeout(() => {
      timedOut = true;
      void context.close().catch(() => {});
    }, spec.timeoutMs);
    timer.unref?.();

    const page = await context.newPage();
    let index = 0;
    outer: for (let repetition = 0; repetition < spec.iterations; repetition++) {
      for (const step of spec.steps) {
        if (cancelled || timedOut)
          break outer;
        const start = performance.now();
        index++;
        try {
          const metadata = await perform(page, step, index, artifactsDir);
          results.push({ index, repetition: repetition + 1, type: step.type,
            ok: true, durationMs: Math.round(performance.now() - start), ...metadata });
        } catch {
          results.push({ index, repetition: repetition + 1, type: step.type,
            ok: false, durationMs: Math.round(performance.now() - start),
            error: cancelled ? 'cancelled' : timedOut ? 'timeout' : 'action_failed' });
          break outer;
        }
      }
    }
  } finally {
    if (timer) clearTimeout(timer);
    if (abortListener) signal?.removeEventListener('abort', abortListener);
    try { await context?.close(); } catch { cleanupFailed = true; }
    try { await browser.close(); } catch { cleanupFailed = true; }
  }
  const ok = !cancelled && !timedOut && !cleanupFailed &&
    results.length === spec.steps.length * spec.iterations && results.every(r => r.ok);
  return { ok, reason: cancelled ? 'cancelled' : timedOut ? 'timeout' :
    cleanupFailed ? 'cleanup_failed' : ok ? null : 'action_failed',
    browser: spec.browser, completed: results.filter(r => r.ok).length,
    total: spec.steps.length * spec.iterations,
    durationMs: Math.round(performance.now() - started), results };
}
