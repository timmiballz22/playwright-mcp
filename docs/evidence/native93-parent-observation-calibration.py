from pathlib import Path
import os,subprocess,json,hashlib
r=Path('/workspace/playwright-mcp');p=Path('/tmp');nodes={'22':Path('/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node'),'24':Path(subprocess.check_output(['which','node'],text=True).strip())};cases=[]
for version,node in nodes.items():
 for mode in (['healthy','negative'] if version=='22' else ['healthy_linger','negative']):
  stem=f'native93-parent-observation{version}-{mode}';proof=p/(stem+'.json');child=p/(stem+'-child.json');env=os.environ.copy();env['PATH']=str(node.parent)+os.pathsep+env['PATH']
  with (p/(stem+'.log')).open('w') as f:proc=subprocess.run([str(node),str(p/'native93-parent-observation-forwarding.mjs'),str(r),mode,str(child),str(proof)],cwd=r,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=80)
  assert proc.returncode==0;d=json.load(open(proof));assert d['status']==(1 if mode=='negative' else 0) and not d['stdoutHasObservation'] and d['stdoutHasAcceptance']==(mode!='negative'),d
  text=(p/(stem+'.log')).read_text();observations=[]
  for line in text.splitlines():
   try:x=json.loads(line)
   except:continue
   if isinstance(x,dict) and x.get('fixture')=='parent_death_initial_observation':observations.append(x)
  assert len(observations)==1 and len(observations[0]['observed'])>=5 and observations[0]['roots'],observations;assert d['child']['storeExists']==(mode=='negative') and d['child']['confirmedJournalCloses']==1,d
  cases.append({'node':version,**d,'initialObservation':observations[0]});print(json.dumps({'node':version,'mode':mode,'sourceExit':d['status'],'observationForwarded':True,'storeRetained':d['child']['storeExists']}),flush=True)
(p/'native93-parent-observation-proof.json').write_text(json.dumps({'phase':'Local followup excluded from completed native93 source47d9c21','cases':cases,'sourceSha256':hashlib.sha256((r/'scripts/verify-guardian-parent-death.mjs').read_bytes()).hexdigest(),'scope':'Actual parent-death/guardian lifetimes and SQLite journal, default execFileSync stderr forwarding; stdout acceptance format preserved. Observation emitted before existing kill/assertions. Linux scoped PIDs retained; Windows full same-snapshot legacy/rows branch awaits native, no simulated Windows pass. No ownership result, role/name/age/window filter, signal or deadline change. Negative cases are calibration only.'},indent=2)+'\n')
