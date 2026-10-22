import pathlib,os,subprocess,re,json
r=pathlib.Path('/workspace/playwright-mcp');p=pathlib.Path('/tmp');nodes={'20':pathlib.Path('/home/agent/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin/node'),'22':pathlib.Path('/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node'),'24':pathlib.Path(subprocess.check_output(['which','node'],text=True).strip())};cases=[]
for version,node in nodes.items():
 env=os.environ.copy();env['PATH']=str(node.parent)+os.pathsep+env['PATH'];log=p/f'native93-stock-pcm-final{version}.log'
 with log.open('w') as f:proc=subprocess.run([str(node),str(r/'node_modules/playwright/cli.js'),'test','tests/media.spec.ts','tests/stock-media.spec.ts','--project=chromium','--project=firefox','--workers=1'],cwd=r,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=90)
 s=log.read_text();assert proc.returncode==0 and re.search(r'4 passed',s),(version,proc.returncode);records=[]
 for line in s.splitlines():
  line=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',line).strip()
  try:d=json.loads(line)
  except ValueError:continue
  if isinstance(d,dict) and d.get('fixture')=='stock_pcm_reference':records.append(d)
 assert len(records)==2 and {d['engine'] for d in records}=={'chromium','firefox'},records
 assert all(d['api']=='stock_playwright' and d['engine']==d['project'] and not d['preloadTimedOut'] and not d['activationTimedOut'] and d['play']['result']=='fulfilled' and d['activated']['currentTime']>0.05 and d['preload']['paused'] for d in records),records
 cases.append({'node':version,'exit':proc.returncode,'passed':4,'stockReceipts':records});print(json.dumps({'node':version,'passed':4,'enginesVerified':['chromium','firefox']}),flush=True)
(p/'native93-stock-pcm-lts-proof.json').write_text(json.dumps({'phase':'Local stock PCM reference excluded from active native93 source47d9c21','cases':cases,'scope':'Original MCP PCM and independent stock Playwright reference, same32044-byte WAV fixture, unchanged original assertions/waits. Stock records preload and a real button-click activation separately before its strict assertions. Built-in Playwright-owned browser/page lifecycle, project-matched engine/channel, no MCP client started by reference. Local Chrome/WebKit not executed; Windows native isolation pending. No unsupported/readiness failure waived.'},indent=2)+'\n')
