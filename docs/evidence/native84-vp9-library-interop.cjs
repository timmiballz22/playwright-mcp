const {createRequire}=require('node:module');
const fs=require('node:fs/promises');
const {createServer}=require('node:http');
const {once}=require('node:events');
const hostRequire=createRequire('/workspace/playwright-mcp/package.json');
const {chromium}=hostRequire('playwright');
const {Client}=hostRequire('@modelcontextprotocol/sdk/client/index.js');
const {InMemoryTransport}=hostRequire('@modelcontextprotocol/sdk/inMemory.js');
(async()=>{
 const http=createServer((_q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end('<button id="add" onclick="document.querySelector(\'output\').textContent=String(++window.count)">Add</button><output>0</output><script>window.count=0</script>');});
 http.listen(0,'127.0.0.1');await once(http,'listening');const url='http://127.0.0.1:'+http.address().port;
 const server=await chromium.launchServer({headless:true});const browser=await chromium.connect(server.wsEndpoint());const records=[];
 try{
  for(const root of ['/workspace/playwright-mcp','/tmp/playwright-vp9-review']){
   const context=await browser.newContext();let getterCalls=0;const lib=createRequire(root+'/package.json')('./index.js');const service=await lib.createConnection({},async()=>{getterCalls++;return context;});const [ct,st]=InMemoryTransport.createLinkedPair();const client=new Client({name:'context-interop-control',version:'1.0.0'});
   try{await service.connect(st);await client.connect(ct);const names=(await client.listTools()).tools.map(t=>t.name).sort();for(const [name,args] of [['browser_navigate',{url}],...Array.from({length:3},()=>['browser_click',{target:'#add'}])]){const result=await client.callTool({name,arguments:args});if(result.isError)throw new Error('Provided-context tool failed');}
    const pages=context.pages();if(getterCalls<1||pages.length!==1||await pages[0].locator('output').textContent()!=='3')throw new Error('Provided context ownership/effect mismatch');
    records.push({root,getterCalls,pages:pages.length,effects:3,tools:names});
   }finally{await client.close();await service.close();await context.close();}
  }
 }finally{await browser.close();await server.close();http.closeAllConnections();await new Promise(resolve=>http.close(resolve));}
 const result={records,sameToolNames:JSON.stringify(records[0].tools)===JSON.stringify(records[1].tools),scope:'Same unpatched host-created BrowserContext passed to baseline and isolated bundled fork library via public contextGetter; three real clicks, no library-client module identity assumption. Host owns final cleanup.'};await fs.writeFile('/tmp/native84-vp9-library-interop.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({sameToolNames:result.sameToolNames,results:records.map(r=>({getterCalls:r.getterCalls,effects:r.effects,tools:r.tools.length}))}));
})().catch(error=>{console.error(error);process.exitCode=1;});
