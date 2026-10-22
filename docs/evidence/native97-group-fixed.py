from pathlib import Path
import subprocess,os,json,shutil
r=Path('/workspace/playwright-mcp');results=[]
for major,node in [(22,Path('/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node')),(24,Path(shutil.which('node')))]:
 for mode in ['fault','healthy']:
  env=os.environ.copy();receipt=Path(f'/tmp/native97-group-fixed{major}-{mode}-receipt.json');env.update(PATH=str(node.parent)+os.pathsep+env['PATH'],NODE_OPTIONS='--import=file:///tmp/native97-group-retention-preload.mjs',OWNED_GROUP_RETAIN_MODE=mode,OWNED_GROUP_RETAIN_RECEIPT=str(receipt));log=Path(f'/tmp/native97-group-fixed{major}-{mode}.log')
  with log.open('w')as f:p=subprocess.run([str(node),'--test','local-batch/process-state-hint.test.mjs'],cwd=r,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=30)
  data=json.loads(receipt.read_text());assert p.returncode==(1 if mode=='fault' else 0),(major,mode,p.returncode);assert all(x['exists']==(mode=='fault')for x in data['directories']);results.append({'node':major,'mode':mode,'exit':p.returncode,**data})
Path('/tmp/native97-group-retention-fixed-proof.json').write_text(json.dumps({'scope':'Real detached factory/group member and read-only hints. Controlled fault follows actual leader-missing hint; self-exit uses existing private stop file, no signal from observed PID. Failed directory kept, healthy removed. Original assertions/limits unchanged.','results':results},indent=2)+'\n');print(json.dumps(results))
