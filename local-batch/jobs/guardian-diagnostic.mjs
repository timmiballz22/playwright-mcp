import { COMMAND_FIELDS, JOURNAL_FAILURE_CAUSES } from './journal-protocol.mjs';
const codes = new Set(['journal_unavailable', 'journal_busy', 'journal_corrupt', 'storage_full', 'invalid_transition', 'invalid_lease', 'invalid_metadata', 'not_found', 'workflow_mismatch', 'unsupported_runtime', 'guardian_failed']);
const stages = new Set(['validation', 'journal_open', 'verify', 'read', 'activate', 'execution', 'write', 'poll', 'drain', 'summary', 'finish']);
export function guardianDiagnostic(error, stage, command) {
  return { stage: stages.has(stage) ? stage : 'unknown', code: codes.has(error?.code) ? error.code : 'guardian_failed', command: COMMAND_FIELDS.has(command) ? command : 'none',
    ...(JOURNAL_FAILURE_CAUSES.includes(error?.journalFailure) ? { journalFailure: error.journalFailure, journalFailureCommand: COMMAND_FIELDS.has(error.journalFailureCommand) ? error.journalFailureCommand : 'none' } : {}) };
}
export function guardianDiagnosticLine(value) {
  const safe = guardianDiagnostic(value, value?.stage, value?.command);
  return `Local job guardian failed (${safe.stage}/${safe.code}/${safe.command}).\n` + journalFailureLine(safe);
}

export function journalFailureLine(value) {
  if (!JOURNAL_FAILURE_CAUSES.includes(value?.journalFailure)) return '';
  const command = COMMAND_FIELDS.has(value.journalFailureCommand) ? value.journalFailureCommand : 'none';
  return `Local job journal unavailable (${value.journalFailure}/${command}).\n`;
}
