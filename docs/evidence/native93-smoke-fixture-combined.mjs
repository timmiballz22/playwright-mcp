import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [target, script, kind, mode, proofPath] = process.argv.slice(2);
let root, primary, opened = 0, confirmedControllerCloses = 0, confirmedJournalCloses = 0, fulfilledClientCloses = 0, injected = false, primaryInjected = false;
const restore = [];
if (kind === 'controller') {
  const { JobController } = await import(pathToFileURL(path.join(target, 'local-batch/jobs/controller.mjs')));
  const original = JobController.open; restore.push(() => JobController.open = original);
  JobController.open = async function(config) {
    root = path.dirname(config.journal.directory); const c = await Reflect.apply(original, this, [config]); opened++;
    const close = c.close; c.close = async function(...args) { const result = await Reflect.apply(close, this, args); if (result.cleanupConfirmed) confirmedControllerCloses++; return result; };
    if (mode === 'negative' && opened === 2) {
      const status = c.status; c.status = async function(...args) { const row = await Reflect.apply(status, this, args); if (row.state === 'SUCCEEDED' && !injected) { injected = true; throw new Error('controlled_assertion_after_actual_reconnect_status'); } return row; };
    }
    return c;
  };
} else if (kind === 'parent_death') {
  const { JobJournal } = await import(pathToFileURL(path.join(target, 'local-batch/jobs/journal.mjs')));
  const original = JobJournal.open; restore.push(() => JobJournal.open = original);
  JobJournal.open = async function(options) {
    root = path.dirname(options.directory); const j = await Reflect.apply(original, this, [options]); opened++;
    const close = j.close; j.close = async function(...args) { await Reflect.apply(close, this, args); confirmedJournalCloses++; };
    if (mode === 'negative') {
      const call = j.call; j.call = async function(command, ...args) { const result = await Reflect.apply(call, this, [command, ...args]); if (command === 'integrity' && !injected) { injected = true; throw new Error('controlled_assertion_after_actual_integrity'); } return result; };
    }
    return j;
  };
} else if (kind === 'profile') {
  const { Client } = await import(pathToFileURL(path.join(target, 'node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')));
  const { StdioClientTransport } = await import(pathToFileURL(path.join(target, 'node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js')));
  const start = StdioClientTransport.prototype.start, close = Client.prototype.close, seen = new WeakSet();
  const call = Client.prototype.callTool;
  if (mode === 'combined') Client.prototype.callTool = async function(params, ...args) { const result = await Reflect.apply(call, this, [params, ...args]); if (params.name === 'browser_cookie_get' && !primaryInjected) { primaryInjected = true; throw new Error('controlled_primary_after_actual_cookie_get'); } return result; };
  restore.push(() => { StdioClientTransport.prototype.start = start; Client.prototype.close = close; Client.prototype.callTool = call; });
  StdioClientTransport.prototype.start = async function(...args) { const value = await Reflect.apply(start, this, args); if (!root) root = await fs.readlink('/proc/' + this.pid + '/cwd'); opened++; return value; };
  Client.prototype.close = async function(...args) {
    await Reflect.apply(close, this, args); if (!seen.has(this)) { seen.add(this); fulfilledClientCloses++; }
    if (['negative', 'combined'].includes(mode) && !injected) { injected = true; throw new Error('controlled_close_after_actual_sdk_close'); }
  };
} else throw new Error('invalid_fixture_kind');
process.argv[2] = target;
try { await import(pathToFileURL(script)); } catch (error) { primary = error; }
finally {
  restore.reverse().forEach(fn => fn());
  let storeExists = false;
  try { const s = await fs.lstat(root); storeExists = s.isDirectory() && !s.isSymbolicLink(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.writeFile(proofPath, JSON.stringify({ kind, mode, sourceScript: script, sourceSucceeded: !primary, errorClass: primary?.name ?? null,
    injected, primaryInjected, errorCount: primary instanceof AggregateError ? primary.errors.length : 0, controlledPrimaryIsCause: primary?.cause?.message === 'controlled_primary_after_actual_cookie_get', opened, confirmedControllerCloses, confirmedJournalCloses, fulfilledClientCloses, workspaceId: path.basename(root), storeExists }, null, 2)+'\n', { flag: 'wx', mode: 0o600 });
}
if (primary) throw primary;
