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
