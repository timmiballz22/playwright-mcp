import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
const writeFile=fs.writeFile;
fs.writeFile=async function(file,...args){
  if(typeof file==='string' && /artifact-parent-death-[^/\\]+[/\\]pending\.tmp$/.test(file)) return await new Promise(()=>{});
  return await writeFile.call(this,file,...args);
};
syncBuiltinESMExports();
