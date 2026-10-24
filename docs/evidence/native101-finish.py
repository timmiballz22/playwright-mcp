import subprocess,json,time,pathlib
p=pathlib.Path('/tmp');pending={39875726421:'wrapper',39875726404:'batch'}
def run(args):
 r=subprocess.run(args,capture_output=True,text=True);print(json.dumps({'command':pathlib.Path(args[1]).name if len(args)>1 else args[0],'exit':r.returncode,'summary':r.stdout[-600:]}),flush=True)
 if r.returncode:raise RuntimeError('collector_failed')
while pending:
 run(['python','/tmp/native101-poll.py'])
 for rid,label in list(pending.items()):
  r=json.loads((p/f'native101-{rid}-rest-run.json').read_text());js=json.loads((p/f'native101-{rid}-rest-jobs.json').read_text())['jobs']
  if r['status']!='completed' or any(j['status']!='completed' or j['conclusion'] is None for j in js):continue
  run(['python','/tmp/native101-collect-completed.py',str(rid),label])
  first=json.loads((p/f'native101-{label}-job-log-exits.json').read_text())
  if any(x['exit'] or not x['bytes'] for x in first):run(['python','/tmp/native101-collect-completed.py',str(rid),label,'1'])
  resolved={x['jobId']:x for x in first};retry=p/f'native101-{label}-job-log-exits-retry1.json'
  if retry.exists():
   resolved.update({x['jobId']:x for x in json.loads(retry.read_text()) if not x['exit'] and x['bytes']})
  assert all(not x['exit'] and x['bytes'] for x in resolved.values()),'unresolved_job_logs'
  (p/f'native101-{label}.log').write_text(''.join((p/x['file']).read_text() for x in resolved.values()))
  with (p/f'native101-{label}-counts.json').open('w') as f:subprocess.run(['node','scripts/ci-test-counts.mjs',str(p/f'native101-{label}.log')],stdout=f,check=True)
  print(json.dumps({'collected':label,'counts':{k:v for k,v in json.loads((p/f'native101-{label}-counts.json').read_text()).items() if k in ['pass','fail','cancelled','skipped']}}),flush=True)
  del pending[rid]
 if pending:time.sleep(45)
for name in ['extract','node24-failure-extract','wrapper-extract','extra-proofs','observations','annotations']:run(['python',f'/tmp/native101-{name}.py'])
