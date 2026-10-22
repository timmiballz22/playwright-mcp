import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const [target, script, mode, proofPath] = process.argv.slice(2);
const { Client } = await import(pathToFileURL(path.join(target, 'node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')));
const { StdioClientTransport } = await import(pathToFileURL(path.join(target, 'node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js')));
const { ownedDescendants } = await import(pathToFileURL(path.join(target, 'local-batch/fixtures/process-audit.mjs')));
const originalMkdtemp = fs.mkdtemp, close = Client.prototype.close, call = Client.prototype.callTool, start = StdioClientTransport.prototype.start;
let root, primary, closeCalls = 0, closeInjected = false, primaryInjected = false, roots = [], observed = [];
fs.mkdtemp = async function(...args) { const result = await Reflect.apply(originalMkdtemp, this, args); if (String(args[0]).startsWith(path.join(os.tmpdir(), 'production-jobs-'))) root = result; return result; };
syncBuiltinESMExports(); assert.equal((await import('node:fs/promises')).mkdtemp, fs.mkdtemp);
StdioClientTransport.prototype.start = async function(...args) { const result = await Reflect.apply(start, this, args); roots.push(this.pid); observed.push(...await ownedDescendants([this.pid], { rememberLiveRoots: true })); return result; };
Client.prototype.callTool = async function(params, ...args) {
  const result = await Reflect.apply(call, this, [params, ...args]);
  if (mode === 'combined' && params.name === 'get_workflow_result' && !primaryInjected && !result.isError) {
    const value = JSON.parse(result.content[0].text);
    if (value.ready && value.job.state === 'SUCCEEDED') { observed.push(...await ownedDescendants(roots, { rememberLiveRoots: true })); primaryInjected = true; throw new Error('controlled_jobs_primary_after_real_result'); }
  }
  return result;
};
Client.prototype.close = async function(...args) {
  await Reflect.apply(close, this, args); closeCalls++;
  if (!closeInjected && (mode === 'combined' && closeCalls === 1 || mode === 'final_close' && closeCalls === 2)) { closeInjected = true; throw new Error('controlled_jobs_close_after_fulfilled_sdk_close'); }
};
process.argv[2] = target;
try { await import(pathToFileURL(script)); } catch (error) { primary = error; }
finally {
  fs.mkdtemp = originalMkdtemp; syncBuiltinESMExports(); Client.prototype.close = close; Client.prototype.callTool = call; StdioClientTransport.prototype.start = start;
  const end = performance.now()+10000; let remaining = await ownedDescendants([...roots,...observed]);
  while (remaining.length && performance.now()<end) { await new Promise(resolve=>setTimeout(resolve,50)); remaining=await ownedDescendants([...roots,...observed]); }
  let storeExists = false;
  try { const s = await fs.lstat(root); storeExists = s.isDirectory() && !s.isSymbolicLink(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.writeFile(proofPath, JSON.stringify({ mode, sourceScript: script, sourceSucceeded: !primary, errorClass: primary?.name ?? null,
    primaryInjected, closeInjected, fulfilledCloseCalls: closeCalls, errorCount: primary instanceof AggregateError ? primary.errors.length : primary ? 1 : 0,
    controlledPrimaryIsCause: primary?.cause?.message === 'controlled_jobs_primary_after_real_result', workspaceId: path.basename(root), storeExists, remainingOwned: remaining.length },null,2)+'\n',{flag:'wx',mode:0o600});
  assert.deepEqual(remaining,[]);
}
if (primary) throw primary;
