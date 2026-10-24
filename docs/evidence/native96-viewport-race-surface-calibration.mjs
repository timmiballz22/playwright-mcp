import {createRequire} from 'node:module';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {jpegSize} from '/workspace/playwright-mcp/tests/fixtures/video-input-observer.mjs';
const require=createRequire('/workspace/playwright-mcp/package.json');const {chromium}=require('playwright');const {PNG}=require('pngjs');const exec=promisify(execFile);const dir=await fs.mkdtemp(path.join(os.tmpdir(),'owned-viewport-race-'));const browser=await chromium.launch({channel:'chromium'});const results=[];let completed=false;
try{
 for(const ordered of [false,true]){
  const context=await browser.newContext({viewport:null});
  try{
   const page=await context.newPage();await page.setContent('<style>html,body{margin:0;background:red}</style><button onclick="document.querySelector(\'output\').textContent=String(++window.count)">Owned click</button><output>0</output><script>window.count=0</script>');
   const session=await context.newCDPSession(page);const {windowId}=await session.send('Browser.getWindowForTarget');
   const bounds=async()=>{await new Promise(r=>setTimeout(r,100));return session.send('Browser.setWindowBounds',{windowId,bounds:{width:320,height:240}});};
   const metrics=()=>session.send('Emulation.setDeviceMetricsOverride',{width:320,height:240,screenWidth:320,screenHeight:240,deviceScaleFactor:1,mobile:false,dontSetVisibleSize:false});
   if(ordered){await bounds();await metrics();}else await Promise.all([bounds(),metrics()]);
   const frames=[];const filename=path.join(dir,ordered?'ordered.webm':'concurrent.webm');
   await page.screencast.start({path:filename,size:{width:320,height:240},fps:10,onFrame:frame=>{if(frames.length<8)frames.push({...jpegSize(frame.data),viewportWidth:frame.viewportWidth,viewportHeight:frame.viewportHeight});}});
   for(let n=0;n<6;n++)await page.getByRole('button',{name:'Owned click',exact:true}).click({timeout:5000});
   const confirmedClicks=Number(await page.locator('output').textContent());await page.screencast.stop();const geometry=await page.evaluate(()=>({innerWidth,innerHeight}));
   const {stdout}=await exec('ffmpeg',['-v','error','-nostdin','-i',filename,'-frames:v','1','-pix_fmt','rgba','-f','image2pipe','-c:v','png','pipe:1'],{timeout:5000,maxBuffer:1048576,encoding:'buffer'});const image=PNG.sync.read(stdout);
   const points=[[100,100],[319,239]].map(([x,y])=>({x,y,pixel:[...image.data.subarray((y*image.width+x)*4,(y*image.width+x)*4+4)]}));
   results.push({mode:ordered?'ordered_existing_requests':'concurrent_existing_requests',requestDelayMs:100,geometry,frames,confirmedClicks,decoded:{width:image.width,height:image.height,points}});await session.detach();
  }finally{await context.close();}
 }
 completed=true;
}finally{await browser.close();if(completed)await fs.rm(dir,{recursive:true,force:true});}
await fs.writeFile('/tmp/native96-viewport-race-surface-proof.json',JSON.stringify({scope:'Actual local full Chromium/Linux; fresh null-viewport contexts and two public-CDP setup calls. Deliberate100ms delay before actual window-bounds dispatch models lagging geometry; no fake acknowledgment, runtime source clone, frame skip or encoder change. Measures this controlled ordering intervention, not native macOS unforced creation cause or fix.',results,privateArtifactsRemoved:completed},null,2)+'\n');console.log(JSON.stringify(results.map(x=>({mode:x.mode,firstFrame:x.frames[0],geometry:x.geometry,decoded:x.decoded}))));
