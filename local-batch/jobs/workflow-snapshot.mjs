import { createHash } from 'node:crypto';
import { validateWorkflow } from '../runner.mjs';
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
// Validate before canonical traversal: the accepted schema has bounded depth and
// action expansion. This digest is never stored unkeyed or returned by tools.
export function captureWorkflow(input) {
  const encoded = JSON.stringify(input);
  if (typeof encoded !== 'string' || Buffer.byteLength(encoded) > 1048576) throw new TypeError('invalid_workflow');
  const workflow = JSON.parse(encoded);
  const spec = validateWorkflow(workflow);
  const digest = createHash('sha256').update(JSON.stringify(canonical(spec))).digest('hex');
  return { workflow, spec, digest };
}
