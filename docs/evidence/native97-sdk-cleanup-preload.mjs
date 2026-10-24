import fs from 'node:fs';import path from 'node:path';import {pathToFileURL}from'node:url';import {syncBuiltinESMExports}from'node:module';import assert from'node:assert/strict';
if(path.basename(process.argv[1]??'')==='diagnose-jobs-startup.mjs'){
 const mode=process.env.OWNED_SDK_CLEANUP_MODE??'healthy';const directories=[];let connections=0,closes=0,faulted=false;
 const mkdtemp=fs.promises.mkdtemp;fs.promises.mkdtemp=async function(...args){const result=await Reflect.apply(mkdtemp,this,args);if(path.basename(result).startsWith('sdk-jobs-startup-'))directories.push(result);return result;};syncBuiltinESMExports();
 const {Client}=await import(pathToFileURL(path.join(process.cwd(),'node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')).href);
 const connect=Client.prototype.connect;Client.prototype.connect=async function(...args){const result=await Reflect.apply(connect,this,args);connections++;return result;};
 const close=Client.prototype.close;Client.prototype.close=async function(...args){const result=await Reflect.apply(close,this,args);closes++;if(connections>=2&&!faulted&&['close','primary_close'].includes(mode)){faulted=true;throw new Error('owned_sdk_close_fault_after_actual_close');}return result;};
 const equal=assert.equal;assert.equal=function(actual,expected,message){const result=Reflect.apply(equal,this,[actual,expected,message]);if(mode.startsWith('primary_')&&message==='Fresh simultaneous SDK startup failed'&&actual===2&&expected===2)throw new Error('owned_sdk_primary_fault_after_actual_startup');return result;};
 const deepEqual=assert.deepEqual;assert.deepEqual=function(actual,expected,...rest){const result=Reflect.apply(deepEqual,this,[actual,expected,...rest]);if(mode==='primary_audit'&&!faulted&&Array.isArray(actual)&&actual.length===0&&Array.isArray(expected)&&expected.length===0){faulted=true;throw new Error('owned_sdk_audit_fault_after_actual_zero');}return result;};
 process.once('exit',()=>fs.writeFileSync(process.env.OWNED_SDK_CLEANUP_RECEIPT,JSON.stringify({mode,connections,closes,controlledFaultInjected:faulted,directories:directories.map(file=>({basename:path.basename(file),exists:fs.existsSync(file)}))})+'\n'));
}
