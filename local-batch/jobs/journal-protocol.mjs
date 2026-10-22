export const JOURNAL_INIT_STAGES = Object.freeze(['not_observed','spawned','received','directory','key','file','open','identity','configure','schema','ready']);
export const JOURNAL_FAILURE_CAUSES = Object.freeze(['rpc_timeout', 'worker_exit', 'worker_error', 'send_failure', 'closed', 'aborted', 'worker_rejected', 'invalid_response']);
export const COMMAND_FIELDS = new Map([
  ['init', ['directory', 'projectId', 'ownerId', 'instanceId', 'pid']],
  ['create', ['id', 'requestKey', 'workflowDigest', 'total', 'deadlineAt', 'admitNew', 'requireCleanLease']],
  ['verify', ['id', 'workflowDigest']],
  ['read', ['id']], ['list', ['limit']], ['events', ['id']], ['result', ['id']], ['cancel', ['id']],
  ['retention', ['beforeMs', 'limit', 'afterId']],
  ['cleanup_reserve', ['id', 'nonce']], ['cleanup_release', ['id', 'nonce']], ['cleanup_uncertain', ['id', 'nonce']],
  ['reserve', ['id', 'nonce', 'queueExpired']], ['activate', ['id', 'nonce']],
  ['progress', ['id', 'nonce', 'completed']], ['resources', ['id', 'nonce', 'workerPid', 'browserPid']],
  ['finish', ['id', 'nonce', 'state', 'completed', 'cleanupOk', 'summary', 'reason']],
  ['recover', []], ['integrity', []], ['close', []],
]);
export function validCommandData(command, data) {
  const allowed = COMMAND_FIELDS.get(command);
  return allowed && data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).every(name => allowed.includes(name));
}
