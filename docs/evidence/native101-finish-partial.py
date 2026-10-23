from pathlib import Path
import subprocess,json
p=Path('/tmp')
for rid,label in [(39875726404,'batch'),(39875726421,'wrapper')]:
 f=p/f'native101-{label}-job-log-exits.json'
 if not f.exists():subprocess.run(['python3','/tmp/native101-collect-completed.py',str(rid),label],check=True)
 rows=json.loads(f.read_text());retry=p/f'native101-{label}-job-log-exits-retry1.json'
 if any(r['exit'] or not r['bytes'] for r in rows) and not retry.exists():subprocess.run(['python3','/tmp/native101-collect-completed.py',str(rid),label,'1'],check=True)
 resolved={r['jobId']:r for r in rows}
 if retry.exists():resolved.update({r['jobId']:r for r in json.loads(retry.read_text()) if not r['exit'] and r['bytes']})
 good=[r for r in resolved.values() if not r['exit'] and r['bytes']];missing=[r for r in resolved.values() if r['exit'] or not r['bytes']];(p/f'native101-{label}.log').write_text(''.join((p/r['file']).read_text() for r in good))
 with (p/f'native101-{label}-counts.json').open('w') as out:subprocess.run(['node','scripts/ci-test-counts.mjs',str(p/f'native101-{label}.log')],stdout=out,check=True)
 (p/f'native101-{label}-log-resolution.json').write_text(json.dumps({'resolved':good,'unresolved':missing,'scope':'Terminal cancelled workflows; empty/failed log retrieval retained after one ordinary retry. Available completed summaries only, never counts for missing/unfinished jobs.'},indent=2)+'\n');print(json.dumps({'label':label,'resolved':len(good),'unresolved':len(missing)}),flush=True)
for n in ['extract','node24-failure-extract','wrapper-extract','extra-proofs','observations','annotations']:
 q=subprocess.run(['python3',f'/tmp/native101-{n}.py'],capture_output=True,text=True);(p/f'native101-{n}-partial-exit.json').write_text(json.dumps({'exit':q.returncode,'stdout':q.stdout,'stderr':q.stderr},indent=2)+'\n');print(json.dumps({'derived':n,'exit':q.returncode}),flush=True)
