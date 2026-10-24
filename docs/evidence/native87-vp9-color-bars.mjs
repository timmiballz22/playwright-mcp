import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import os from 'node:os';
import { ownedDescendants } from '/workspace/playwright-mcp/local-batch/fixtures/process-audit.mjs';
const root=process.argv[2],destination=process.argv[3];
if(!['/workspace/playwright-mcp','/tmp/playwright-vp9-review','/tmp/playwright-vp9-primaries-review'].includes(root))throw new Error('Invalid controlled root');
const require=createRequire(path.join(root,'package.json'));const {chromium,firefox}=require('playwright');
const bundle=require.resolve('playwright-core/lib/coreBundle');const coreSha256=createHash('sha256').update(await readFile(bundle)).digest('hex');
const witnessEnabled=process.argv[4]==='--witness';const preconditions=[];
const directory=await mkdtemp(path.join(os.tmpdir(),'vp9-bars-'));const clips=new Map();const results=[];const servers=[];const roots=[];let observed=[];let failure;
const fixture=createServer((req,res)=>{const clip=clips.get(req.url);if(clip){res.writeHead(200,{'Content-Type':'video/webm','Content-Length':clip.length});res.end(clip);return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(req.url.startsWith('/player')?'<video muted preload="auto"></video>':`<!doctype html><style>html,body{margin:0}main{display:grid;width:100vw;height:100vh;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}button{position:fixed;left:1px;top:1px}</style><main><div style="background:#f00"></div><div style="background:#0f0"></div><div style="background:#00f"></div><div style="background:#fff"></div></main><button onclick="this.dataset.count=String(Number(this.dataset.count||0)+1)">Owned capture</button>`);});
fixture.listen(0,'127.0.0.1');await once(fixture,'listening');const origin='http://127.0.0.1:'+fixture.address().port;
try{
 const browsers=[];
 for(const [engine,type] of [['chromium',chromium],['firefox',firefox]]){const server=await type.launchServer({headless:true,timeout:10000});servers.push(server);roots.push(server.process().pid);browsers.push({engine,browser:await type.connect(server.wsEndpoint())});}
 observed=await ownedDescendants(roots,{rememberLiveRoots:true});
 for(const producer of browsers)for(const size of [{width:320,height:240},{width:1920,height:1080}]){
  const context=await producer.browser.newContext({viewport:size,deviceScaleFactor:1});const page=await context.newPage();const filename=path.join(directory,producer.engine+'-'+size.width+'.webm');
  try{await page.goto(origin,{timeout:5000});
  if(witnessEnabled){const {PNG}=require('pngjs');const bytes=await page.screenshot({scale:'css',timeout:5000});if(bytes.length>8388608)throw new Error('Source screenshot byte bound');const png=PNG.sync.read(bytes);const pixels=[[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([a,b])=>Array.from(png.data.subarray((Math.floor(png.height*b)*png.width+Math.floor(png.width*a))*4,(Math.floor(png.height*b)*png.width+Math.floor(png.width*a))*4+4)));const expected=[[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,255,255]];const correct=png.width===size.width&&png.height===size.height&&pixels.every((pixel,i)=>pixel.every((v,j)=>Math.abs(v-expected[i][j])<=20));preconditions.push({producer:producer.engine,...size,pixels,correct});if(!correct)throw new Error('Source paint precondition failed');}
  await page.screencast.start({path:filename,size,fps:10});for(let n=0;n<6;n++)await page.getByRole('button',{name:'Owned capture',exact:true}).click({timeout:3000});if(await page.locator('button').getAttribute('data-count')!=='6')throw new Error('Capture effect count mismatch');await page.screencast.stop();}finally{await context.close();}
  if((await stat(filename)).size>8388608)throw new Error('Control recording bound exceeded');const clipPath='/clip/'+producer.engine+'-'+size.width;clips.set(clipPath,await readFile(filename));
  for(const decoder of browsers){const dc=await decoder.browser.newContext();try{const p=await dc.newPage();await p.goto(origin+'/player',{timeout:5000});await p.locator('video').evaluate((video,url)=>{video.src=url;video.load();},origin+clipPath);await p.waitForFunction(()=>document.querySelector('video').readyState>=2,undefined,{timeout:3000});const sample=await p.locator('video').evaluate(video=>{const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;const x=c.getContext('2d');x.drawImage(video,0,0);return {width:c.width,height:c.height,pixels:[[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([a,b])=>Array.from(x.getImageData(Math.floor(c.width*a),Math.floor(c.height*b),1,1).data))};});const expected=[[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,255,255]];const correct=sample.width===size.width&&sample.height===size.height&&sample.pixels.every((pixel,i)=>pixel.every((v,j)=>Math.abs(v-expected[i][j])<=20));results.push({producer:producer.engine,decoder:decoder.engine,requested:size,...sample,correct});}finally{await dc.close();}}
 }
}catch(error){failure=error;throw error;}finally{
 const closed=await Promise.allSettled(servers.map(server=>server.close()));fixture.closeAllConnections();await new Promise(resolve=>fixture.close(resolve));const remaining=await ownedDescendants([...roots,...observed]);const record={root,coreSha256,witnessEnabled,preconditions,results,correct:results.filter(r=>r.correct).length,total:results.length,closeFailures:closed.filter(r=>r.status==='rejected').length,ownedObservedAfter:remaining.length,primaryFailed:!!failure,scope:'Controlled public screencast API; red/green/blue/white quadrants, SD/HD, two producer/decoder engines. Not full media/native or performance proof.'};await writeFile(destination,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({coreSha256,correct:record.correct,total:record.total,closeFailures:record.closeFailures,ownedObservedAfter:remaining.length}));if(closed.some(r=>r.status==='rejected')||remaining.length)throw new Error('Color control owned cleanup failed');
}
