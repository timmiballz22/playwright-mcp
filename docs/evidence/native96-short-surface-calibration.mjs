import { createRequire } from 'node:module';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {jpegSize} from '/workspace/playwright-mcp/tests/fixtures/video-input-observer.mjs';
const require=createRequire('/workspace/playwright-mcp/package.json');const {chromium}=require('playwright');const {PNG}=require('pngjs');const exec=promisify(execFile);
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'owned-short-surface-'));const browser=await chromium.launch({channel:'chromium'});const results=[];let completed=false;
try {
 for(const short of [false,true]) {
  const context=await browser.newContext({viewport:{width:320,height:240},deviceScaleFactor:1});
  try {
   const page=await context.newPage();await page.setContent('<style>html,body{margin:0;background:rgb(255,0,0)}</style><button onclick="document.querySelector(\'output\').textContent=String(++window.count)">Record owned click</button><output>0</output><script>window.count=0</script>');
   const session=await context.newCDPSession(page);const {windowId}=await session.send('Browser.getWindowForTarget');
   if(short) {
    await session.send('Browser.setWindowBounds',{windowId,bounds:{width:320,height:98}});
    await session.send('Emulation.setDeviceMetricsOverride',{width:320,height:240,screenWidth:320,screenHeight:240,deviceScaleFactor:1,mobile:false,dontSetVisibleSize:true});
   }
   const geometry=await page.evaluate(()=>({innerWidth,innerHeight,visualWidth:visualViewport.width,visualHeight:visualViewport.height}));
   const {bounds}=await session.send('Browser.getWindowBounds',{windowId});
   const frames=[];const filename=path.join(dir,short?'short.webm':'normal.webm');
   await page.screencast.start({path:filename,size:{width:320,height:240},fps:10,onFrame:frame=>{if(frames.length<8)frames.push({...jpegSize(frame.data),viewportWidth:frame.viewportWidth,viewportHeight:frame.viewportHeight});}});
   for(let n=0;n<6;n++)await page.getByRole('button',{name:'Record owned click',exact:true}).click({timeout:5000});
   const confirmed=await page.locator('output').textContent();await page.screencast.stop();
   const {stdout}=await exec('ffmpeg',['-v','error','-nostdin','-i',filename,'-frames:v','1','-pix_fmt','rgba','-f','image2pipe','-c:v','png','pipe:1'],{timeout:5000,maxBuffer:1048576,encoding:'buffer'});
   const image=PNG.sync.read(stdout);const points=[[100,100],[319,239]].map(([x,y])=>({x,y,pixel:[...image.data.subarray((y*image.width+x)*4,(y*image.width+x)*4+4)]}));
   results.push({case:short?'deliberately_short_visible_surface':'normal',geometry,bounds:{width:bounds.width,height:bounds.height},frames,confirmedClicks:Number(confirmed),decoded:{width:image.width,height:image.height,points}});
   await session.detach();
  }finally{await context.close();}
 }
 completed=true;
}finally{await browser.close();if(completed)await fs.rm(dir,{recursive:true,force:true});}
await fs.writeFile('/tmp/native96-short-surface-proof.json',JSON.stringify({scope:'Real full Chromium on local Linux. Deliberate public-CDP window/visible-surface geometry control; no source clone, encoder replacement, frame skip or original-test waiver. Tests padding mechanism, not native macOS creation cause or proposed ordering fix.',results,privateArtifactsRemoved:completed},null,2)+'\n');
console.log(JSON.stringify(results.map(x=>({case:x.case,geometry:x.geometry,bounds:x.bounds,firstInput:x.frames[0],decoded:x.decoded}))));
