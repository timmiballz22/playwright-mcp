// Local-only, declarative Playwright workflow engine. No shell execution or arbitrary JS evaluation.
// Copyright 2026 contributors. Licensed under Apache-2.0, see ../LICENSE.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { ScreenshotBudget } from './screenshot-budget.mjs';
import { allowedAddress, validateExecutionPolicy } from './policy.mjs';
import { classifyActionFailure } from './failure.mjs';
import { navigationRetryPolicy, navigationRetryDelay, parseRetryAfter } from './navigation-retry.mjs';
import { setTimeout as delay } from 'node:timers/promises';

export const MAX_STEPS = 1000;
export const MAX_ITERATIONS = 100;
const TYPES = new Set(['goto', 'click', 'fill', 'press', 'check', 'uncheck',
  'hover', 'waitFor', 'assertText', 'assertURL', 'scroll', 'screenshot']);
const SELECTOR_TYPES = new Set(['click', 'fill', 'press', 'check', 'uncheck',
  'hover', 'waitFor', 'assertText']);
const FIELDS = { goto: ['url'], assertURL: ['url'], click: ['selector'], fill: ['selector', 'value'], press: ['selector', 'key'], check: ['selector'], uncheck: ['selector'], hover: ['selector'], waitFor: ['selector'], assertText: ['selector', 'contains', 'equals'], scroll: ['deltaX', 'deltaY'], screenshot: [] };
function exactKeys(object, keys) {
  if (Object.keys(object).some(key => !keys.includes(key)))
    throw new TypeError('Unknown property');
}
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

function validateSelector(selector) {
  if (typeof selector === 'string') return asString(selector, 'selector', 500);
  if (!selector || typeof selector !== 'object' || Array.isArray(selector))
    throw new TypeError('Invalid selector');
  if ('role' in selector) {
    exactKeys(selector, ['role', 'name']);
    asString(selector.role, 'role', 100);
    asString(selector.name, 'name', 500);
  } else {
    const keys = Object.keys(selector);
    if (keys.length !== 1 || !['testId', 'label', 'placeholder', 'text'].includes(keys[0]))
      throw new TypeError('Invalid selector');
    asString(selector[keys[0]], 'selector value', 500);
  }
  return { ...selector };
}

function resolveLocator(page, selector) {
  if (typeof selector === 'string') return page.locator(selector);
  if (selector.role) return page.getByRole(selector.role, { name: selector.name, exact: true });
  if (selector.testId) return page.getByTestId(selector.testId);
  if (selector.label) return page.getByLabel(selector.label, { exact: true });
  if (selector.placeholder) return page.getByPlaceholder(selector.placeholder, { exact: true });
  return page.getByText(selector.text, { exact: true });
}

export function validateWorkflow(workflow) {
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow))
    throw new TypeError('Workflow must be an object');
  if (Buffer.byteLength(JSON.stringify(workflow), 'utf8') > 1048576)
    throw new TypeError('Workflow exceeds 1 MiB');
  if (workflow.schemaVersion !== undefined && workflow.schemaVersion !== 1)
    throw new TypeError('Unsupported workflow schema version');
  exactKeys(workflow, ['schemaVersion', 'browser', 'timeoutMs', 'actionTimeoutMs', 'iterations', 'steps']);
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
  let expandedCount = 0;
  const steps = workflow.steps.flatMap((step, i) => {
    if (!step || typeof step !== 'object' || Array.isArray(step) || !TYPES.has(step.type))
      throw new TypeError('Invalid action type at step ' + i);
    exactKeys(step, ['type', 'repeat', ...FIELDS[step.type]]);
    const repeat = integer(step.repeat, 'repeat', 1, MAX_STEPS, 1);
    expandedCount += repeat;
    if (expandedCount * iterations > MAX_STEPS)
      throw new TypeError('Expanded workflow exceeds total action cap');
    if (SELECTOR_TYPES.has(step.type))
      validateSelector(step.selector);
    if (step.type === 'goto' || step.type === 'assertURL')
      asString(step.url, 'step ' + i + ' url', 2000);
    if (step.type === 'fill' && (typeof step.value !== 'string' || step.value.length > 10000))
      throw new TypeError('step ' + i + ' value must be a string of at most 10000 characters');
    if (step.type === 'press')
      asString(step.key, 'step ' + i + ' key', 100);
    if (step.type === 'assertText') {
      if (('contains' in step) === ('equals' in step))
        throw new TypeError('Text assertion requires exactly one of contains or equals');
      if ('contains' in step) asString(step.contains, 'contains', 2000);
      else if (typeof step.equals !== 'string' || step.equals.length > 2000)
        throw new TypeError('equals must be a string of at most 2000 characters');
    }
    if (step.type === 'scroll') {
      integer(step.deltaY, 'deltaY', -10000, 10000, 0);
      integer(step.deltaX, 'deltaX', -10000, 10000, 0);
    }
    const copy = { ...step, ...(SELECTOR_TYPES.has(step.type) ? { selector: validateSelector(step.selector) } : {}) };
    delete copy.repeat;
    return Array.from({ length: repeat }, () => ({ ...copy }));
  });
  return { browser, timeoutMs, actionTimeoutMs, iterations, steps };
}

async function perform(page, step, index, artifactsDir, screenshots, canPublish) {
  const locator = step.selector ? resolveLocator(page, step.selector) : undefined;
  switch (step.type) {
    case 'goto': {
      const response = await page.goto(step.url, { waitUntil: 'domcontentloaded' });
      const status = response?.status();
      if (Number.isInteger(status) && status >= 400 && status <= 599) {
        const safeCode = status === 429 ? 'rate_limited' : status === 401 ? 'http_401' :
          status === 403 ? 'http_403' : status === 404 ? 'http_404' : status >= 500 ? 'http_5xx' : 'http_4xx';
        const rawRetryAfter = response.headers()['retry-after'];
        const parsed = parseRetryAfter(rawRetryAfter);
        const retryAfterMs = Number.isSafeInteger(Math.ceil(parsed)) && parsed >= 0 && parsed <= 86400000 ? Math.ceil(parsed) : undefined;
        throw Object.assign(new Error('HTTP navigation failed'), { safeCode, httpStatus: status, retryAfterMs });
      }
      break;
    }
    case 'click': await locator.click(); break;
    case 'fill': await locator.fill(step.value); break;
    case 'press': await locator.press(step.key); break;
    case 'check': await locator.check(); break;
    case 'uncheck': await locator.uncheck(); break;
    case 'hover': await locator.hover(); break;
    case 'waitFor': await locator.waitFor({ state: 'visible' }); break;
    case 'assertText': {
      const text = await locator.textContent();
      if ('equals' in step ? text !== step.equals : !text?.includes(step.contains))
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
      await screenshots.publish(page, target, { canPublish });
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
  allowSensitiveArtifacts = false,
  readOnly = false,
  maxScreenshotBytes,
  onBrowserProcess,
  onProgress,
  navigationRetry, // Trusted operator opt-in for safe GET navigation only.
  onActionFailure, // Trusted source diagnostics only; never accepted in workflow JSON.
} = {}) {
  const spec = validateWorkflow(workflow);
  const allowed = validateExecutionPolicy(spec, { allowedOrigins, allowSensitiveArtifacts, readOnly, maxScreenshotBytes });
  const retryPolicy = navigationRetryPolicy(navigationRetry);
  const screenshots = new ScreenshotBudget(maxScreenshotBytes);
  if (signal?.aborted)
    return { ok: false, reason: 'cancelled', completed: 0, results: [] };

  const started = performance.now();
  let browser;
  let browserServer;
  let context;
  let cancelled = false;
  let timedOut = false;
  let cleanupFailed = false;
  const cleanupFailures = [];
  let blockedRequests = 0;
  let closing = false;
  let currentNavigation;
  const retryAbort = new AbortController();
  let rejectStopped;
  const stopped = new Promise((_, reject) => { rejectStopped = reject; });
  // A stop can arrive between operations; mark rejection handled immediately.
  void stopped.catch(() => {});
  const stop = reason => {
    if (cancelled || timedOut) return;
    cancelled = reason === 'cancelled';
    timedOut = reason === 'timeout';
    retryAbort.abort();
    rejectStopped(new Error(reason));
    void context?.close().catch(() => {});
    void browser?.close().catch(() => {});
    void browserServer?.close().catch(() => {});
  };
  const abortListener = () => stop('cancelled');
  signal?.addEventListener('abort', abortListener, { once: true });
  if (signal?.aborted) abortListener();
  const timer = setTimeout(() => stop('timeout'), spec.timeoutMs);
  const bounded = operation => Promise.race([operation, stopped]);
  const results = [];
  try {
    await bounded(mkdir(artifactsDir, { recursive: true, mode: 0o700 }));
    artifactsDir = path.join(artifactsDir, 'run-' + randomUUID());
    await bounded(mkdir(artifactsDir, { mode: 0o700 }));
    const playwright = suppliedPlaywright ?? await bounded(import('playwright'));
    const launchOptions = { headless: true, timeout: Math.max(1, spec.timeoutMs - (performance.now() - started)) };
    if (onBrowserProcess || typeof playwright[spec.browser].launchServer === 'function') {
      // Public BrowserServer.process() gives the watchdog an owned PID. Its
      // WebSocket endpoint is loopback-only, private, and never model-visible.
      browserServer = await bounded(playwright[spec.browser].launchServer({ ...launchOptions, host: '127.0.0.1' }).then(server => {
        // Retain ownership even if a trusted source observer throws.
        browserServer = server;
        if (cancelled || timedOut) void server.kill().catch(() => {});
        onBrowserProcess?.(server.process().pid);
        return server;
      }));
      browser = await bounded(playwright[spec.browser].connect(browserServer.wsEndpoint(), { timeout: launchOptions.timeout }));
    } else {
      browser = await bounded(playwright[spec.browser].launch(launchOptions).then(value => {
        if (cancelled || timedOut) void value.close().catch(() => {});
        return value;
      }));
    }
    context = await bounded(browser.newContext({ acceptDownloads: false, serviceWorkers: 'block' }).then(value => {
      if (cancelled || timedOut) void value.close().catch(() => {});
      return value;
    }));
    context.setDefaultTimeout(spec.actionTimeoutMs);
    context.setDefaultNavigationTimeout(Math.min(30000, spec.timeoutMs));

    // Playwright route.continue() does not re-intercept server redirect hops.
    // Fetch without following redirects, and fail closed on all redirects until
    // redirect method/body/cookie semantics have a separately verified executor.
    await bounded(context.route('**/*', async route => {
      try {
        if (!allowedAddress(route.request().url(), allowed) || readOnly && !['GET', 'HEAD'].includes(route.request().method())) {
          blockedRequests++;
          return await route.abort('blockedbyclient');
        }
        let response;
        for (let attempt = 0; ; attempt++) {
          if (closing || cancelled || timedOut) throw new Error('stopped');
          response = await route.fetch({ maxRedirects: 0, maxRetries: 0,
            timeout: Math.max(1, spec.timeoutMs - (performance.now() - started)) });
          const request = route.request();
          const eligible = retryPolicy && currentNavigation && request.method() === 'GET' &&
            request.isNavigationRequest() && request.frame() === page.mainFrame() &&
            request.url() === currentNavigation;
          const wait = eligible ? navigationRetryDelay(response.status(), response.headers()['retry-after'], attempt, retryPolicy) : null;
          const remaining = spec.timeoutMs - (performance.now() - started);
          if (wait === null || wait >= remaining) break;
          await response.dispose();
          await delay(wait, undefined, { signal: retryAbort.signal });
        }
        if (response.status() >= 300 && response.status() < 400 && response.headers().location) {
          blockedRequests++;
          await route.abort('blockedbyclient');
        } else {
          await route.fulfill({ response });
        }
        await response.dispose();
      } catch {
        if (!closing) blockedRequests++;
        await route.abort('failed').catch(() => {});
      }
    }));
    // No WebSocket transport is approved in this initial strict policy.
    if (context.routeWebSocket)
      await bounded(context.routeWebSocket('**/*', socket => { blockedRequests++; socket.close(); }));

    const page = await bounded(context.newPage());
    let index = 0;
    outer: for (let repetition = 0; repetition < spec.iterations; repetition++) {
      for (const step of spec.steps) {
        if (cancelled || timedOut)
          break outer;
        const start = performance.now();
        index++;
        try {
          currentNavigation = undefined;
          if (step.type === 'goto') {
            const target = new URL(step.url); target.hash = '';
            currentNavigation = target.href;
          }
          const metadata = await bounded(perform(page, step, index, artifactsDir, screenshots, () => {
            if (performance.now() - started >= spec.timeoutMs) stop('timeout');
            return !cancelled && !timedOut && !closing;
          }));
          currentNavigation = undefined;
          results.push({ index, repetition: repetition + 1, type: step.type,
            ok: true, durationMs: Math.round(performance.now() - start), ...metadata });
          onProgress?.({ completed: results.length });
        } catch (error) {
          const httpFailure = ['rate_limited', 'http_401', 'http_403', 'http_404', 'http_4xx', 'http_5xx'].includes(error?.safeCode);
          const safeError = cancelled ? 'cancelled' : timedOut ? 'timeout' : httpFailure ? error.safeCode : 'action_failed';
          const failureKind = cancelled || timedOut ? 'interrupted' : classifyActionFailure(error, step);
          try { onActionFailure?.(error, { index, type: step.type, error: safeError, failureKind }, page); } catch {}
          results.push({ index, repetition: repetition + 1, type: step.type,
            ok: false, durationMs: Math.round(performance.now() - start),
            error: safeError, failureKind,
            ...(httpFailure ? { httpStatus: error.httpStatus, ...(error.retryAfterMs !== undefined ? { retryAfterMs: error.retryAfterMs } : {}) } : {}) });
          break outer;
        }
      }
    }
  } catch {
    if (!cancelled && !timedOut)
      results.push({ index: 0, type: 'setup', ok: false, error: 'setup_failed' });
  } finally {
    closing = true;
    retryAbort.abort();
    if (timer) clearTimeout(timer);
    if (abortListener) signal?.removeEventListener('abort', abortListener);
    for (const [name, resource] of [['context', context], ['browser', browser], ['server', browserServer]]) {
      let cleanupTimer;
      const timeoutError = new Error('cleanup_timeout');
      try {
        await Promise.race([resource?.close(), new Promise((_, reject) => { cleanupTimer = setTimeout(() => reject(timeoutError), 5000); })]);
      } catch (error) {
        cleanupFailed = true; cleanupFailures.push(name + (error === timeoutError ? '_timeout' : '_error'));
        if (name === 'server' && typeof resource?.kill === 'function') {
          // Only this run's public BrowserServer handle carries kill authority.
          // Preserve the close failure even if this final bounded attempt works.
          let killTimer;
          const killTimeout = new Error('cleanup_timeout');
          try {
            await Promise.race([resource.kill(), new Promise((_, reject) => { killTimer = setTimeout(() => reject(killTimeout), 1000); })]);
          } catch (error) { cleanupFailures.push(error === killTimeout ? 'server_kill_timeout' : 'server_kill_error'); }
          finally { clearTimeout(killTimer); }
        }
      }
      finally { clearTimeout(cleanupTimer); }
    }
  }
  const actionsSucceeded = results.length === spec.steps.length * spec.iterations && results.every(r => r.ok);
  const ok = blockedRequests === 0 && !cancelled && !timedOut && !cleanupFailed && actionsSucceeded;
  return { ok, reason: cancelled ? 'cancelled' : timedOut ? 'timeout' :
    cleanupFailed ? 'cleanup_failed' : blockedRequests ? 'policy_blocked' : ok ? null : 'action_failed',
    browser: spec.browser, blockedRequests, actionsSucceeded, cleanupFailures, completed: results.filter(r => r.ok).length,
    total: spec.steps.length * spec.iterations,
    durationMs: Math.round(performance.now() - started), results };
}
