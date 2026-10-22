from pathlib import Path
import subprocess,os,json,hashlib
r=Path('/workspace/playwright-mcp');p=Path('/tmp');results=[]
for version,node in [('22',Path('/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node')),('24',Path(subprocess.check_output(['which','node'],text=True).strip()))]:
 stem=f'native92-journal-fixture-after{version}-healthy';proof=p/(stem+'.json');env=os.environ.copy();env['PATH']=str(node.parent)+os.pathsep+env['PATH']
 with (p/(stem+'.log')).open('w') as f:proc=subprocess.run([str(node),str(p/'native92-journal-fixture-calibration.mjs'),str(r),str(r/'scripts/production-journal-smoke.mjs'),'healthy',str(proof)],cwd=r,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=60)
 x=json.load(open(proof));assert proc.returncode==0 and x['sourceSucceeded'] and x['realClosed']==2 and not x['storeExists'],x;results.append({'node':version,**x})
proof=json.load(open(p/'native92-journal-fixture-preservation-proof.json'));proof['positiveCases']=results;proof['baselineCommit']='6884c4ae4052fed5579b9d21d181bb06c1ea2b55';proof['fixedSmokeSha256']=hashlib.sha256((r/'scripts/production-journal-smoke.mjs').read_bytes()).hexdigest();proof['baselineSmokeSha256']=hashlib.sha256((p/'playwright-journal-fixture-baseline/scripts/production-journal-smoke.mjs').read_bytes()).hexdigest();(p/'native92-journal-fixture-preservation-proof.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps({'positiveCases':len(results),'allRealWorkersClosed':True,'positiveStoresRemoved':True}))
