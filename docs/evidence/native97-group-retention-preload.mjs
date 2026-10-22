import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{syncBuiltinESMExports}from'node:module';
if(path.basename(process.argv[1]??'')==='process-state-hint.test.mjs'){
 const directories=[];let injected=false;const mkdtemp=fs.promises.mkdtemp;fs.promises.mkdtemp=async function(...args){const value=await Reflect.apply(mkdtemp,this,args);if(path.basename(value).startsWith('group-hint-orphan-'))directories.push(value);return value;};syncBuiltinESMExports();
 const equal=assert.equal;assert.equal=function(actual,expected,...args){const result=Reflect.apply(equal,this,[actual,expected,...args]);if(process.env.OWNED_GROUP_RETAIN_MODE==='fault'&&!injected&&directories.length&&actual===1&&expected===1){injected=true;throw new Error('owned_group_primary_after_actual_leader_hint');}return result;};
 process.once('exit',()=>fs.writeFileSync(process.env.OWNED_GROUP_RETAIN_RECEIPT,JSON.stringify({injected,directories:directories.map(file=>({basename:path.basename(file),exists:fs.existsSync(file)}))})+'\n'));
}
