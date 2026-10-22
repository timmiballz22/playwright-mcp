import { workflowInputSchema } from '../local-batch/workflow-contract.mjs';
import { STEP_FAILURE_CODES, FAILURE_KINDS } from '../local-batch/failure.mjs';

// Small fixed diagnostic projection for CI/client receipts. Never copy a step's
// locator, URL, input value, artifact path or raw error into the receipt.
export function stepFailureDiagnostic(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const bounded = (number, min, max) => Number.isSafeInteger(number) && number >= min && number <= max ? number : undefined;
  return { index: bounded(value.index, value.type === 'setup' ? 0 : 1, value.type === 'setup' ? 0 : 1000), repetition: bounded(value.repetition, 1, 100),
    type: value.type === 'setup' || workflowInputSchema.properties.steps.items.properties.type.enum.includes(value.type) ? value.type : 'unknown',
    error: STEP_FAILURE_CODES.includes(value.error) || value.type === 'setup' && value.error === 'setup_failed' ? value.error : 'unknown',
    failureKind: FAILURE_KINDS.includes(value.failureKind) ? value.failureKind : 'unknown',
    durationMs: bounded(value.durationMs, 0, 180000), httpStatus: bounded(value.httpStatus, 400, 599) };
}

// Preserve raw-fixture counters before its longer trusted diagnostic is truncated.
export function rawWorkflowFailureDiagnostic(result, diagnostic, { browser, mode, freshRun } = {}) {
  if (!result || typeof result !== 'object' || result.ok !== false) return null;
  const bounded = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max ? value : undefined;
  return { fixture: 'raw_browser_failure', browser: ['chromium', 'firefox', 'webkit'].includes(browser) ? browser : 'unknown',
    mode: ['headless', 'headed', 'direct-pipe'].includes(mode) ? mode : 'unknown', freshRun: bounded(freshRun, 1, 20),
    reason: ['cancelled', 'timeout', 'resource_limit', 'cleanup_failed', 'policy_blocked', 'action_failed'].includes(result.reason) ? result.reason : 'unknown',
    completed: bounded(result.completed, 0, 1000), total: bounded(result.total, 1, 1000), durationMs: bounded(result.durationMs, 0, 300000),
    actionsSucceeded: typeof result.actionsSucceeded === 'boolean' ? result.actionsSucceeded : undefined,
    cleanupFailureCount: Array.isArray(result.cleanupFailures) ? bounded(result.cleanupFailures.length, 0, 8) : undefined,
    failedStep: stepFailureDiagnostic(diagnostic) };
}

// Developer-only static-fixture wire hint. IDs are protocol IDs, never PIDs.
// Observe one bounded debug frame; never retain or emit params/results.
export function createProtocolProjection() {
  const methods = new Set(['Page.dispatchMouseEvent', 'Page.dispatchKeyEvent', 'Page.navigate', 'Page.close',
    'Page.scrollIntoViewIfNeeded', 'Page.getContentQuads', 'Page.getBoundingClientRect', 'Page.setViewport',
    'Runtime.evaluate', 'Runtime.callFunction', 'Runtime.callFunctionOn', 'Runtime.releaseObject', 'Runtime.getObjectProperties',
    'Browser.close', 'Browser.newPage', 'Browser.createBrowserContext', 'Browser.removeBrowserContext',
    'Network.setRequestInterception', 'Network.resumeInterceptedRequest', 'Network.fulfillInterceptedRequest']);
  const pending = new Map(); const lastSent = [];
  let sent = 0; let responses = 0; let droppedPending = 0; let idReuse = 0; let unparsedFrames = 0;
  return {
    observe(chunk) {
      const prefix = typeof chunk === 'string' ? chunk.slice(0, 8192) : Buffer.isBuffer(chunk) ? chunk.toString('utf8', 0, Math.min(chunk.length, 8192)) : '';
      const line = prefix.replace(/\u001b\[[0-9;]*m/g, '');
      const frame = /pw:protocol\s+(SEND ►|◀ RECV)\s+(\{[^\r\n]*)/.exec(line);
      if (!frame) return;
      // Reply bodies can be large or debug-truncated. Their leading ID is
      // sufficient for correlation; never require parsing a result payload.
      if (frame[1] === '◀ RECV') {
        const match = /^\{"id":(-?\d+)(?:,|\})/.exec(frame[2]);
        const id = Number(match?.[1]);
        if (match && Number.isSafeInteger(id) && Math.abs(id) <= 2147483647) { responses++; pending.delete(id); return; }
      }
      let message;
      try { message = JSON.parse(frame[2].slice(0, frame[2].lastIndexOf('}') + 1)); }
      catch { unparsedFrames++; return; }
      if (!message || typeof message !== 'object' || Array.isArray(message)) return;
      const id = message.id; if (!Number.isSafeInteger(id) || Math.abs(id) > 2147483647) return;
      if (frame[1] === '◀ RECV') { responses++; pending.delete(id); return; }
      if (typeof message.method !== 'string') return;
      const method = methods.has(message.method) ? message.method : 'other'; sent++;
      if (pending.has(id)) idReuse++;
      else if (pending.size === 256) { pending.delete(pending.keys().next().value); droppedPending++; }
      pending.set(id, method); lastSent.push({ id, method }); if (lastSent.length > 16) lastSent.shift();
    },
    snapshot() {
      return { coverage: 'bounded_debug_frames', sent, responses, droppedPending, idReuse, unparsedFrames, pendingCount: pending.size,
        pending: [...pending].slice(0, 16).map(([id, method]) => ({ id, method })), lastSent: lastSent.map(value => ({ ...value })) };
    },
  };
}
