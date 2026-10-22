// Trusted local fixture-only fault after original owned journal exit confirmation.
import { JobJournal } from '/workspace/playwright-mcp/local-batch/jobs/journal.mjs';
const close = JobJournal.prototype.close;
const seen = new WeakSet();
JobJournal.prototype.close = async function() {
  await close.call(this);
  if (this.exitConfirmed !== true) throw new Error('controlled_close_fault_requires_confirmed_real_exit');
  if (!seen.has(this)) {
    seen.add(this);
    console.log(JSON.stringify({ fixture: 'controlled_multi_journal_close_fault', realJournalExitConfirmed: true }));
  }
  throw Object.assign(new Error('controlled_journal_close_failure'), { code: 'qa_close_failure' });
};
