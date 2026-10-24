import subprocess,json,pathlib,concurrent.futures,sys
rid=int(sys.argv[1]);label=sys.argv[2];attempt=int(sys.argv[3]) if len(sys.argv)>3 else 0
run=json.loads(pathlib.Path(f'/tmp/native97-{rid}-rest-run.json').read_text());assert run['status']=='completed','workflow_not_complete'
jobs=json.loads(pathlib.Path(f'/tmp/native97-{rid}-rest-jobs.json').read_text())['jobs'];assert all(j['status']=='completed' and j['conclusion'] is not None for j in jobs),'job_metadata_not_terminal'
selected=[j for j in jobs if j['conclusion']!='skipped'];suffix='' if not attempt else f'-retry{attempt}'
if attempt:
 prior=json.loads(pathlib.Path(f'/tmp/native97-{label}-job-log-exits.json').read_text());failed={r['jobId'] for r in prior if r['exit']!=0 or r.get('bytes',0)==0};selected=[j for j in selected if j['id'] in failed]
def fetch(j):
 dest=pathlib.Path(f'/tmp/native97-{label}-job-{j["id"]}{suffix}.log');assert not dest.exists(),'retain_existing_read'
 try:
  with dest.open('w') as f:p=subprocess.run(['gh','run','view',str(rid),'--log','--job',str(j['id'])],stdout=f,stderr=subprocess.PIPE,text=True,timeout=60)
  return {'jobId':j['id'],'name':j['name'],'exit':p.returncode,'bytes':dest.stat().st_size,'file':dest.name,'attempt':attempt,'error':[l.split('https://')[0].split('http://')[0][:160] for l in p.stderr.splitlines()[:2]]}
 except subprocess.TimeoutExpired:return {'jobId':j['id'],'name':j['name'],'exit':124,'bytes':dest.stat().st_size,'file':dest.name,'attempt':attempt}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:results=list(executor.map(fetch,selected))
pathlib.Path(f'/tmp/native97-{label}-job-log-exits{suffix}.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps({'label':label,'attempt':attempt,'reads':len(results),'success':sum(x['exit']==0 for x in results),'failedCount':sum(x['exit']!=0 for x in results)}))
if not attempt and all(r['exit']==0 for r in results):pathlib.Path(f'/tmp/native97-{label}.log').write_text(''.join(pathlib.Path('/tmp',r['file']).read_text() for r in results))
