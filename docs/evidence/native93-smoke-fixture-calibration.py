from pathlib import Path
import os,subprocess,json,hashlib
r=Path('/workspace/playwright-mcp');p=Path('/tmp');nodes={'22':Path('/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node'),'24':Path(subprocess.check_output(['which','node'],text=True).strip())};names={'controller':'production-controller-smoke.mjs','profile':'production-profile-smoke.mjs','parent_death':'verify-guardian-parent-death.mjs'};cases=[]
for variant,versions,modes in [('before',['22'],['negative']),('after',['22','24'],['negative','healthy'])]:
 for version in versions:
  for mode in modes:
   for kind,name in names.items():
    script=(p/'playwright-smoke-fixtures-baseline/scripts'/name) if variant=='before' else r/'scripts'/name;stem=f'native93-smoke-{variant}{version}-{kind}-{mode}';proof=p/(stem+'.json');env=os.environ.copy();env['PATH']=str(nodes[version].parent)+os.pathsep+env['PATH']
    with (p/(stem+'.log')).open('w') as f:proc=subprocess.run([str(nodes[version]),str(p/'native93-smoke-fixture-calibration.mjs'),str(r),str(script),kind,mode,str(proof)],cwd=r,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=80)
    x=json.load(open(proof));expectedExit=0 if mode=='healthy' or variant=='before' and kind=='profile' else 1;assert proc.returncode==expectedExit,(variant,version,kind,mode,proc.returncode,x);assert x['storeExists']==(variant=='after' and mode=='negative'),x;assert x['injected']==(mode=='negative'),x
    if kind=='controller':assert x['confirmedControllerCloses']==2,x
    if kind=='profile':assert x['fulfilledClientCloses']==3,x
    if kind=='parent_death':assert x['confirmedJournalCloses']==1,x
    cases.append({'node':version,'variant':variant,'exit':proc.returncode,**x});print(json.dumps({'node':version,'variant':variant,'kind':kind,'mode':mode,'exit':proc.returncode,'storeRetained':x['storeExists']}),flush=True)
(p/'native93-smoke-fixture-preservation-proof.json').write_text(json.dumps({'phase':'Local followup excluded from active native93 source47d9c21','baselineCommit':'47d9c2153ec33a02c2713b3f9a10944364f70972','cases':cases,'fixedSourceSha256':{name:hashlib.sha256((r/'scripts'/name).read_bytes()).hexdigest() for name in names.values()},'scope':'Actual smoke scripts import real controller/journal/SDK modules; no source clone or mocked browser. Controller error follows actual successful reconnect status; parent-death error follows actual integrity; profile error follows fulfilled SDK close and existing owned audit. Only fixed-source negative stores retained; positive stores removed. No new cleanup action, wait, deadline, ownership filter or runtime setting. Negative calibrations are not native/production passes. Linux public SDK PID /proc cwd observation records profile fixture root only and never authorizes signals.'},indent=2)+'\n')
