import pathlib,os,subprocess,re,json,hashlib
r=pathlib.Path('/workspace/playwright-mcp');p=pathlib.Path('/tmp');nodes={'20':pathlib.Path('/home/agent/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin/node'),'22':pathlib.Path('/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node'),'24':pathlib.Path(subprocess.check_output(['which','node'],text=True).strip())};cases=[]
for version,node in nodes.items():
 env=os.environ.copy();env['PATH']=str(node.parent)+os.pathsep+env['PATH'];log=p/f'native93-stock-references{version}.log'
 with log.open('w') as f:proc=subprocess.run([str(node),str(r/'node_modules/playwright/cli.js'),'test','tests/stock-media.spec.ts','--project=chromium','--project=firefox','--workers=1'],cwd=r,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=90)
 s=log.read_text();assert proc.returncode==0 and re.search(r'4 passed',s),(version,proc.returncode);records=[]
 for line in s.splitlines():
  line=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',line).strip()
  try:d=json.loads(line)
  except ValueError:continue
  if isinstance(d,dict) and d.get('fixture') in ['stock_pcm_reference','stock_screenshot_reference']:records.append(d)
 assert len(records)==4 and all(d['engine']==d['project'] and d['api']=='stock_playwright' for d in records),records
 pcm=[d for d in records if d['fixture']=='stock_pcm_reference'];images=[d for d in records if d['fixture']=='stock_screenshot_reference']
 assert len(pcm)==len(images)==2 and all(not d['preloadTimedOut'] and not d['activationTimedOut'] and d['play']['result']=='fulfilled' for d in pcm)
 assert all(d['captured'] and d['width']==320 and d['height']==240 and d['pixel'][0]>=230 and d['pixel'][1]<=20 and d['pixel'][2]<=20 and d['pixel'][3]==255 for d in images)
 cases.append({'node':version,'exit':proc.returncode,'passed':4,'receipts':records});print(json.dumps({'node':version,'passed':4,'stockPCM':2,'stockScreenshot':2}),flush=True)
(p/'native93-stock-references-proof.json').write_text(json.dumps({'phase':'Local stock references excluded from active native93 source47d9c21','cases':cases,'referenceSha256':hashlib.sha256((r/'tests/stock-media.spec.ts').read_bytes()).hexdigest(),'pcmFixtureSha256':hashlib.sha256((r/'tests/fixtures/owned-pcm.mjs').read_bytes()).hexdigest(),'scope':'Independent stock Playwright PCM preload/real activation and one exact owned red PNG capture per context; no MCP client, screenshot retry/warmup, changed original assertion, timeout or project default. Built-in Playwright browser/context/page lifecycle. Actual engine fields verified on Linux Chromium/Firefox on all LTSs. Chrome/WebKit/native Windows and macOS comparisons pending; no underlying cause/fix claim.'},indent=2)+'\n')
