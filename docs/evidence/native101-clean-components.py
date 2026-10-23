from pathlib import Path
import subprocess,json,os,shlex
r=Path('/tmp/playwright-native101-components-review');p=Path('/tmp');env=dict(os.environ);env['PATH']='/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:'+env['PATH'];results=[]
def run(name,args):
 with (p/(name+'.log')).open('w') as f:q=subprocess.run(args,cwd=r,env=env,stdout=f,stderr=subprocess.STDOUT)
 results.append({'stage':name,'exit':q.returncode});(p/'native101-clean-components-exits.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results[-1]),flush=True);return q.returncode
assert run('native101-clean-before-install',['node','--test','qa/bounded-stderr.test.mjs'])!=0
assert run('native101-clean-npm-ci',['npm','ci'])==0
text=(r/'.github/workflows/local-batch.yml').read_text();line=next(l for l in text.splitlines() if 'run: node --test --test-concurrency=1 --test-reporter=tap' in l);args=shlex.split(line.split('run: ',1)[1].split(' 2>&1',1)[0]);assert run('native101-clean-components22',args)==0
