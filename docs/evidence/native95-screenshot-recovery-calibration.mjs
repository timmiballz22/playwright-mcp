import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire('/workspace/playwright-mcp/package.json');
const {chromium}=require('playwright');const {PNG}=require('pngjs');
const browser=await chromium.launch();const results=[];
try {
 for(const mode of ['healthy','first_unavailable','persistent_unavailable','other_protocol','deadline']) {
  const page=await browser.newPage({viewport:{width:320,height:240}});
  await page.setContent('<style>html,body{margin:0;background:rgb(255,0,0)}</style>');
  const impl=page._connection.toImpl(page);const client=impl.delegate._mainFrameSession._client;
  const send=client.send;
  let nativeError;
  try {await send.call(client,'Page.captureScreenshot',{format:'owned-invalid-format'});} catch(e){nativeError=e;}
  assert.equal(typeof nativeError.setMessage,'function');
  let attempts=0, actualCaptures=0;
  client.send=async function(method,...args) {
   if(method!=='Page.captureScreenshot')return Reflect.apply(send,this,[method,...args]);
   attempts++;
   const value=await Reflect.apply(send,this,[method,...args]);actualCaptures++;
   if(mode==='deadline')return new Promise(()=>{});
   if(mode==='persistent_unavailable'||mode==='first_unavailable'&&attempts===1||mode==='other_protocol') {
    nativeError.setMessage(mode==='other_protocol'?'Owned distinct protocol failure':'Unable to capture screenshot');throw nativeError;
   }
   return value;
  };
  const start=performance.now();let passed=false,error='none';
  try {const png=PNG.sync.read(await page.screenshot({timeout:mode==='deadline'?300:5000}));const p=[...png.data.subarray((100*png.width+100)*4,(100*png.width+100)*4+4)];assert.deepEqual(p,[255,0,0,255]);passed=true;}
  catch(e){error=e.name==='TimeoutError'?'timeout':e.message.includes('Unable to capture screenshot')?'unavailable':e.message.includes('Owned distinct protocol failure')?'other_protocol':'unexpected';}
  results.push({mode,passed,error,attempts,actualCaptures,elapsedMs:Math.round(performance.now()-start)});
  client.send=send;await page.close();
 }
} finally {await browser.close();}
await fs.writeFile(process.argv[2],JSON.stringify({scope:'Trusted calibration imports real installed Playwright, captures real owned red PNGs, then injects a calibrated real ProtocolError after capture. Demonstrates recovery logic and bounds, not a reproduction or causal proof of the native engine failure.',results},null,2)+'\n');
console.log(JSON.stringify(results.map(({mode,passed,error,attempts,elapsedMs})=>({mode,passed,error,attempts,elapsedMs}))));
