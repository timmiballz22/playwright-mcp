import { COMMAND_FIELDS, JOURNAL_FAILURE_CAUSES } from './journal-protocol.mjs';
const codes = new Set(['journal_unavailable', 'journal_busy', 'journal_corrupt', 'storage_full', 'invalid_transition', 'invalid_lease', 'invalid_metadata', 'not_found', 'workflow_mismatch', 'unsupported_runtime', 'guardian_failed']);
const stages = new Set(['validation', 'journal_open', 'journal_close', 'verify', 'read', 'activate', 'execution', 'write', 'poll', 'drain', 'summary', 'finish']);
export function guardianDiagnostic(error, stage, command) {
  return { stage: stages.has(stage) ? stage : 'unknown', code: codes.has(error?.code) ? error.code : 'guardian_failed', command: COMMAND_FIELDS.has(command) ? command : 'none',
    ...(JOURNAL_FAILURE_CAUSES.includes(error?.journalFailure) ? { journalFailure: error.journalFailure, journalFailureCommand: COMMAND_FIELDS.has(error.journalFailureCommand) ? error.journalFailureCommand : 'none' } : {}),
    ...(error?.journalExitConfirmed === false ? { journalExitConfirmed: false } : {}) };
}
export function guardianDiagnosticLine(value) {
  const safe = guardianDiagnostic(value, value?.stage, value?.command);
  return `Local job guardian failed (${safe.stage}/${safe.code}/${safe.command}).\n` + journalFailureLine(safe);
}

export function journalFailureLine(value) {
  const unconfirmed = value?.journalExitConfirmed === false ? 'Local job journal worker exit unconfirmed.\n' : '';
  if (!JOURNAL_FAILURE_CAUSES.includes(value?.journalFailure)) return unconfirmed;
  const command = COMMAND_FIELDS.has(value.journalFailureCommand) ? value.journalFailureCommand : 'none';
  return `Local job journal unavailable (${value.journalFailure}/${command}).\n` +
    unconfirmed;
}

// Client-side hints only: no raw stderr, process identity or cleanup authority.
export function guardianStderrFacts(value) {
  const text = typeof value === 'string' ? value.slice(-4096) : '';
  const failures = new Set(); const journals = new Set(); const exits = new Set(); let capped = false;
  const add = (set, entry) => { if (set.has(entry)) return; if (set.size < 16) set.add(entry); else capped = true; };
  for (const match of text.matchAll(/Local job guardian failed \(([a-z_]{1,40})\/([a-z_]{1,40})\/([a-z_]{1,40})\)/g)) {
    if ((stages.has(match[1]) || match[1] === 'unknown') && codes.has(match[2]) && (COMMAND_FIELDS.has(match[3]) || match[3] === 'none')) add(failures, match.slice(1).join('/'));
  }
  for (const match of text.matchAll(/Local job journal unavailable \(([a-z_]{1,40})\/([a-z_]{1,40})\)/g)) {
    if (JOURNAL_FAILURE_CAUSES.includes(match[1]) && (COMMAND_FIELDS.has(match[2]) || match[2] === 'none')) add(journals, match.slice(1).join('/'));
  }
  for (const match of text.matchAll(/Local job guardian exited \((unknown|-?[0-9]{1,10})\/(none|SIGKILL|SIGTERM|SIGABRT|SIGSEGV|SIGINT)\)/g)) {
    // Windows may report unsigned NTSTATUS values (for example 0xC0000005).
    if (match[1] === 'unknown' || Number.isSafeInteger(Number(match[1])) && Number(match[1]) >= -2147483648 && Number(match[1]) <= 4294967295) add(exits, match.slice(1).join('/'));
  }
  return { coverage: 'bounded_stderr_tail', guardianFailures: [...failures], journalFailures: [...journals], guardianExits: [...exits],
    journalExitUnconfirmed: text.includes('Local job journal worker exit unconfirmed.'), inputTruncated: typeof value === 'string' && value.length > 4096, capped };
}
