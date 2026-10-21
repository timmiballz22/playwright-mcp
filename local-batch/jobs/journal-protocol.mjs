export const COMMAND_FIELDS = new Map([
  ['init', ['directory', 'projectId', 'ownerId', 'instanceId', 'pid']],
  ['create', ['id', 'requestKey', 'workflowDigest', 'total', 'deadlineAt', 'admitNew', 'requireCleanLease']],
  ['verify', ['id', 'workflowDigest']],
  ['read', ['id']], ['list', ['limit']], ['events', ['id']], ['result', ['id']], ['cancel', ['id']],
  ['reserve', ['id', 'nonce']], ['activate', ['id', 'nonce']],
  ['progress', ['id', 'nonce', 'completed']], ['resources', ['id', 'nonce', 'workerPid', 'browserPid']],
  ['finish', ['id', 'nonce', 'state', 'completed', 'cleanupOk', 'summary', 'reason']],
  ['recover', []], ['integrity', []], ['close', []],
]);
export function validCommandData(command, data) {
  const allowed = COMMAND_FIELDS.get(command);
  return allowed && data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).every(name => allowed.includes(name));
}
