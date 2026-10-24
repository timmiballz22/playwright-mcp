import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [target, script, mode, proofPath] = process.argv.slice(2);
const { JobJournal } = await import(pathToFileURL(path.join(target, 'local-batch/jobs/journal.mjs')));
const open = JobJournal.open; let directory, calls = 0, realClosed = 0, closeInjected = false, primary;
JobJournal.open = async function(options) {
  directory = options.directory; calls++;
  if (mode === 'init_pause' && calls === 1) {
    process.env.PLAYWRIGHT_TEST_JOURNAL_INIT_PAUSE = 'schema_tables';
    return await Reflect.apply(open, this, [{ ...options, workerModule: pathToFileURL(path.join(target, 'local-batch/jobs/fixtures/transaction-fault.mjs')) }]);
  }
  const client = await Reflect.apply(open, this, [options]); const close = client.close;
  client.close = async function(...args) {
    await Reflect.apply(close, this, args); realClosed++;
    if (mode === 'close_failure' && !closeInjected) { closeInjected = true; throw Object.assign(new Error('controlled_close_failure_after_real_exit'), { code: 'controlled_close_failure_after_real_exit' }); }
  };
  return client;
};
process.argv[2] = target;
try { await import(pathToFileURL(script)); } catch (error) { primary = error; }
finally {
  JobJournal.open = open; delete process.env.PLAYWRIGHT_TEST_JOURNAL_INIT_PAUSE;
  let exists = false, fileCount = 0;
  try { const stat = await fs.lstat(directory); exists = stat.isDirectory() && !stat.isSymbolicLink(); if (exists) fileCount = (await fs.readdir(directory)).length; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const proof = { mode, sourceScript: script, sourceSucceeded: !primary, errorClass: primary?.name ?? null,
    openCalls: calls, realClosed, closeInjected, initFailure: primary?.journalFailure ?? null,
    initStage: primary?.journalInitStage ?? null, initExitConfirmed: primary?.journalExitConfirmed ?? null,
    storeExists: exists, workspaceId: path.basename(directory), fileCount };
  await fs.writeFile(proofPath, JSON.stringify(proof, null, 2)+'\n', { flag: 'wx', mode: 0o600 });
}
if (primary) throw primary;
