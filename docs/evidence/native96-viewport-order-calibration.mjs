import {createRequire} from 'node:module';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const require=createRequire('/workspace/playwright-mcp/package.json');const {chromium}=require('playwright');
const browser=await chromium.launch({channel:'chromium'});let out;
try {
 const page=await browser.newPage();await page.setContent('<style>html,body{margin:0;background:red}</style>');
 const client=page._connection.toImpl(page).delegate._mainFrameSession._client;const send=client.send;
 let bounds=0,metrics=0,boundsCompleted=false,metricsBeforeBoundsCompleted=false;
 client.send=async function(method,...args){
  if(method==='Browser.setWindowBounds'){bounds++;const result=await Reflect.apply(send,this,[method,...args]);await new Promise(r=>setTimeout(r,100));boundsCompleted=true;return result;}
  if(method==='Emulation.setDeviceMetricsOverride'){metrics++;if(!boundsCompleted)metricsBeforeBoundsCompleted=true;}
  return Reflect.apply(send,this,[method,...args]);
 };
 try {await page.setViewportSize({width:320,height:240});} finally {client.send=send;}
 const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));assert.equal(bounds,1);assert.equal(metrics,1);
 out={scope:'Real full Chromium, Linux. Trusted100ms delayed resolution after actual bounds request; demonstrates request-promise sequencing, not native macOS geometry causality.',engine:'chromium',channel:'chromium',bounds,metrics,boundsCompleted,metricsBeforeBoundsCompleted,viewport};
} finally {await browser.close();}
await fs.writeFile(process.argv[2],JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
