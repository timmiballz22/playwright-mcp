// Source-owned transport calibration, not a browser/MCP feature acceptance test.
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { guardianStderrFacts } from '../../local-batch/jobs/guardian-diagnostic.mjs';
import { ownedScopeDescendants } from '../../local-batch/fixtures/process-audit.mjs';
const program = `const {createInterface}=require('node:readline');
const timer=setTimeout(()=>process.exit(70),5000);
const notify=(method,params={})=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',method,params})+'\\n');
const lines=createInterface({input:process.stdin});
lines.once('line',()=>{const waiting=!process.stderr.write(Buffer.alloc(1048576,'private-ci-canary'),()=>{
process.stderr.write('Local job journal unavailable (rpc_timeout/read).\\n',()=>notify('notifications/owned_finished'));});
notify('notifications/owned_started',{waiting});});
process.stdin.once('end',()=>{clearTimeout(timer);process.exit(0)});`;
const transport = new StdioClientTransport({command:process.execPath,args:['-e',program],stderr:'pipe'});
let started=false;let finished=false;let backpressured=false;let transportError=false;
transport.onmessage=packet=>{if(packet.method==='notifications/owned_started'){started=true;backpressured=packet.params?.waiting===true;}if(packet.method==='notifications/owned_finished')finished=true;};
transport.onerror=()=>{transportError=true;};
const until=async predicate=>{const end=performance.now()+2000;while(!predicate()&&!transportError&&performance.now()<end)await delay(5);assert.equal(transportError,false);assert.ok(predicate());};
let scope;let bytes=0;let tail='';let facts=guardianStderrFacts('');
try {
await transport.start();const pid=transport.pid;assert.ok(Number.isSafeInteger(pid));
scope={roots:new Set([pid]),identities:new Map()};await ownedScopeDescendants([scope],{rememberLiveRoots:true});assert.equal(transport.pid,pid);
await transport.send({jsonrpc:'2.0',method:'notifications/owned_start'});await until(()=>started);assert.equal(backpressured,true);
await delay(100);assert.equal(finished,false,'Unconsumed pipe unexpectedly completed');
transport.stderr.on('data',chunk=>{bytes+=chunk.length;tail=(tail+chunk.toString()).slice(-4096);facts=guardianStderrFacts(tail);});
await until(()=>finished&&facts.journalFailures.includes('rpc_timeout/read'));assert.ok(bytes>=1048576);assert.equal(JSON.stringify(facts).includes('private-ci-canary'),false);
await transport.close();assert.deepEqual(await ownedScopeDescendants([scope]),[]);
console.log(JSON.stringify({fixture:'sdk_stderr_backpressure',diagnosticLineInjected:true,mcpHandshakeExercised:false,browserActions:0,unreadPhaseBlocked:true,writeBackpressured:true,consumedBytes:bytes,journalFailures:facts.journalFailures,activeOwnedProcesses:0,modelTurns:0}));
} finally {await transport.close();}
