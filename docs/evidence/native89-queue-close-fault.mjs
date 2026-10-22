// Trusted local negative QA only; never loaded by a product entrypoint.
import { JobJournal } from '/workspace/playwright-mcp/local-batch/jobs/journal.mjs';
const close = JobJournal.prototype.close;
JobJournal.prototype.close = async function() {
  await close.call(this);
  if (this.exitConfirmed !== true) throw new Error('controlled_close_fault_requires_confirmed_real_exit');
  console.log(JSON.stringify({ fixture: 'controlled_queue_close_fault', realJournalExitConfirmed: true }));
  throw Object.assign(new Error('controlled_queue_close_failure'), { code: 'qa_close_failure' });
};
