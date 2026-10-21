import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JobController } from './controller.mjs';
test('controller expires its queued input by monotonic elapsed time when wall deadline remains in the future', async () => {
  let row; let expired = false;
  const journal = { call: async (command, data) => {
    if (command === 'recover') return { cleanupBlocked: false };
    if (command === 'create') return row = { jobId: data.id, state: 'QUEUED', completed: 0, total: 1, deadlineAt: new Date(Date.now() + 3600000).toISOString() };
    if (command === 'read') return row;
    if (command === 'reserve') {
      assert.equal(data.queueExpired, true); expired = true;
      row = { ...row, state: 'TIMED_OUT', reason: 'queue_expired' };
      return { acquired: false, reason: 'not_started' };
    }
    throw new Error('Unexpected journal command');
  } };
  const controller = new JobController(journal, {}, { allowedOrigins: [] });
  controller.schedule = () => {};
  const job = await controller.start({ timeoutMs: 100, steps: [{ type: 'waitFor', selector: '#unused' }] }, 'clock');
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal((await controller.status(job.jobId)).state, 'TIMED_OUT');
  assert.equal(expired, true); assert.equal(controller.inputs.size, 0);
});
