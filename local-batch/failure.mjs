export const TERMINATION_FAILURE_CODES = Object.freeze(['invalid_root', 'windows_taskkill_failed', 'worker_stop_failed', 'enumeration_failed', 'descendant_signal_failed', 'browser_group_signal_failed', 'worker_group_signal_failed', 'wait_timeout']);
export const FAILURE_KINDS = Object.freeze(['interrupted', 'http_failure', 'assertion_mismatch',
  'not_visible', 'not_enabled', 'not_stable', 'detached', 'pointer_intercepted',
  'locator_timeout', 'pointer_action_timeout', 'navigation_timeout', 'target_closed', 'ambiguous_locator', 'invalid_selector', 'artifact_quota', 'page_quota', 'unknown']);
export const STEP_FAILURE_CODES = Object.freeze(['cancelled', 'timeout', 'action_failed',
  'rate_limited', 'http_401', 'http_403', 'http_404', 'http_4xx', 'http_5xx']);

// Best-effort fixed codes only. Never return a substring of a browser message.
export function classifyActionFailure(error, step) {
  if (error?.code === 'SCREENSHOT_BYTE_LIMIT') return 'artifact_quota';
  if (STEP_FAILURE_CODES.slice(3).includes(error?.safeCode)) return 'http_failure';
  const message = typeof error?.message === 'string' ? error.message : '';
  if (['assertText', 'assertURL'].includes(step.type) && ['Text assertion failed', 'URL assertion failed'].includes(message)) return 'assertion_mismatch';
  if (error?.name === 'TimeoutError') {
    const markers = [['element is not visible', 'not_visible'], ['element is not enabled', 'not_enabled'],
      ['element is not stable', 'not_stable'], ['element was detached', 'detached'],
      ['intercepts pointer events', 'pointer_intercepted']];
    if (message.lastIndexOf('performing click action') > message.lastIndexOf('click action done'))
      markers.push(['performing click action', 'pointer_action_timeout']);
    const last = markers.map(([marker, kind]) => [message.lastIndexOf(marker), kind]).sort((a, b) => b[0] - a[0])[0];
    return last[0] >= 0 ? last[1] : step.type === 'goto' ? 'navigation_timeout' : 'locator_timeout';
  }
  if (message.includes('Target page, context or browser has been closed')) return 'target_closed';
  if (message.includes('strict mode violation')) return 'ambiguous_locator';
  if (message.includes('while parsing css selector') || message.includes('Unknown engine')) return 'invalid_selector';
  return 'unknown';
}
