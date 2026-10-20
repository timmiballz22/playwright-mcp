import { JobJournal } from '../journal.mjs';
import { randomUUID } from 'node:crypto';
const journal = await JobJournal.open({ directory: process.argv[2], projectId: process.argv[3], ownerId: 'recovery-owner' });
const record = await journal.call('create', { id: randomUUID(), requestKey: 'recovery-request',
  workflowDigest: 'a'.repeat(64), total: 1, deadlineAt: Date.now() + 30000 });
process.stdout.write(JSON.stringify({ jobId: record.jobId }) + '\n');
setInterval(() => {}, 1000);
