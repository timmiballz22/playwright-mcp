import { chromium, firefox } from '/workspace/playwright-mcp/node_modules/playwright/index.mjs';
import { ownedDescendants } from '/workspace/playwright-mcp/local-batch/fixtures/process-audit.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
const files = new Map(await Promise.all(['chromium','firefox','bt601-firefox'].map(async name => ['/'+name, await readFile('/tmp/native83-video-'+(name.startsWith('bt601-')?name:'first-'+name)+'.webm')])));
const http = createServer((req,res) => { const bytes=files.get(req.url); if(bytes){res.writeHead(200,{'Content-Type':'video/webm','Content-Length':bytes.length});res.end(bytes);}else{res.writeHead(200,{'Content-Type':'text/html'});res.end('<video muted loop preload="auto"></video>');} });
http.listen(0,'127.0.0.1');await once(http,'listening');const origin='http://127.0.0.1:'+http.address().port;
try {
 for(const [engine,type] of [['chromium',chromium],['firefox',firefox]]){
  const server=await type.launchServer({headless:true});let browser;const roots=[server.process().pid];let captured=[];
  try{
   captured=await ownedDescendants(roots,{rememberLiveRoots:true});browser=await type.connect(server.wsEndpoint());const page=await browser.newPage();
   for(const producer of ['bt601-firefox']){
    await page.goto(origin,{timeout:10000});await page.locator('video').evaluate((video,url)=>{video.src=url;video.load();},origin+'/'+producer);
    await page.waitForFunction(()=>document.querySelector('video').readyState>=2,undefined,{timeout:3000});
    const sample=()=>page.locator('video').evaluate(video=>{const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;const c=canvas.getContext('2d');c.drawImage(video,0,0);return {width:video.videoWidth,height:video.videoHeight,ready:video.readyState,time:video.currentTime,paused:video.paused,pixel:Array.from(c.getImageData(100,100,1,1).data)};});
    const initial=await sample();await page.locator('video').evaluate(video=>video.play());await page.waitForFunction(()=>document.querySelector('video').currentTime>0.05,undefined,{timeout:3000});await page.locator('video').evaluate(video=>video.pause());const advanced=await sample();
    console.log(JSON.stringify({fixture:'cross_decode',engine,producer,initial,advanced}));
   }
  }finally{await browser?.close();await server.close();const remaining=await ownedDescendants([...roots,...captured]);console.log(JSON.stringify({fixture:'cross_decode_cleanup',engine,observed:remaining.length}));if(remaining.length)throw new Error('Cross-decoder owned cleanup failed');}
 }
}finally{http.closeAllConnections();await new Promise(resolve=>http.close(resolve));}
