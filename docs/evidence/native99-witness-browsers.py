from pathlib import Path
import subprocess,os,json
r=Path('/workspace/playwright-mcp');p=Path('/tmp');rows=[]
for major,node in [('20','/home/agent/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin/node'),('22','/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node')]:
 env=os.environ.copy();env.update(PLAYWRIGHT_BATCH_TEST_BROWSERS='chromium,firefox',PATH=str(Path(node).parent)+os.pathsep+env['PATH']);log=p/f'native99-witness-browser{major}.log';assert not log.exists(),'retain_prior_attempt'
 with log.open('w') as f:v=subprocess.run([node,'--test','--test-name-pattern=cancellation preserves a committed POST','local-batch/navigation-retry-browser.test.mjs'],cwd=r,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=90)
 rows.append({'nodeMajor':major,'exit':v.returncode,'log':log.name});(p/'native99-witness-browser-exits.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows[-1]),flush=True)
 if v.returncode:raise SystemExit(v.returncode)
