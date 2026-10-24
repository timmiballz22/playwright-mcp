from pathlib import Path
import subprocess,json,os
r=Path('/workspace/playwright-mcp');p=Path('/tmp');cases=[]
for mode,registered in [('init_pause',0),('close_failure',2)]:
 stem=f'native92-journal-fixture-final24-{mode}';proof=p/(stem+'.json')
 with (p/(stem+'.log')).open('w') as f:proc=subprocess.run(['node',str(p/'native92-journal-fixture-calibration.mjs'),str(r),str(r/'scripts/production-journal-smoke.mjs'),mode,str(proof)],cwd=r,stdout=f,stderr=subprocess.STDOUT,timeout=60)
 x=json.load(open(proof));assert proc.returncode==1 and x['storeExists'];s=(p/(stem+'.log')).read_text();receipts=[]
 for l in s.splitlines():
  try:d=json.loads(l)
  except:continue
  if isinstance(d,dict) and d.get('component')=='installed_journal_fixture_preserved':receipts.append(d)
 assert len(receipts)==1 and receipts[0]['registeredClients']==registered,(mode,receipts);cases.append({'mode':mode,'exit':proc.returncode,'proof':x,'receipt':receipts[0]})
a=json.load(open(p/'native92-journal-fixture-preservation-proof.json'));a['finalDiagnosticCases']=cases;(p/'native92-journal-fixture-preservation-proof.json').write_text(json.dumps(a,indent=2)+'\n');print(json.dumps({'finalNegativeCases':len(cases),'registeredClientCountsVerified':True}))
