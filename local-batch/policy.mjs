import { validateScreenshotLimit } from './screenshot-budget.mjs';
// Operator policy is never accepted in workflow/tool input.
export function parseOrigins(allowedOrigins) {
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

export function allowedAddress(raw, allowed) {
  let url;
  try { url = new URL(raw); } catch { return false; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    return false;
  return allowed.has(url.origin);
}

export function validateExecutionPolicy(spec, { allowedOrigins = [], allowSensitiveArtifacts = false, readOnly = false, maxScreenshotBytes } = {}) {
  validateScreenshotLimit(maxScreenshotBytes);
  if (typeof readOnly !== 'boolean') throw new TypeError('readOnly must be boolean');
  const allowed = parseOrigins(allowedOrigins);
  if (spec.steps.some(step => step.type === 'screenshot') && allowSensitiveArtifacts !== true)
    throw new TypeError('Sensitive artifact capture requires local operator approval');
  for (const step of spec.steps) {
    if ((step.type === 'goto' || step.type === 'assertURL') && !allowedAddress(step.url, allowed))
      throw new TypeError('Navigation origin is not approved; configure allowed origins locally');
    if (readOnly && !['goto', 'assertURL', 'assertText', 'waitFor', 'scroll', 'screenshot'].includes(step.type))
      throw new TypeError('Mutation actions require local operator approval');
  }
  return allowed;
}
