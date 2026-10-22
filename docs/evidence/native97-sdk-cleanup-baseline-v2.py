from pathlib import Path
import os,subprocess,json
r=Path('/workspace/playwright-mcp');node=Path('/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node');results=[]
for mode in ['primary_audit']:
 receipt=Path(f'/tmp/native97-sdk-baseline-v2-{mode}-receipt.json');log=Path(f'/tmp/native97-sdk-baseline-v2-{mode}.log');env=os.environ.copy();env.update(PATH=str(node.parent)+os.pathsep+env['PATH'],NODE_OPTIONS='--import=file:///tmp/native97-sdk-cleanup-preload-v2.mjs',OWNED_SDK_CLEANUP_MODE=mode,OWNED_SDK_CLEANUP_RECEIPT=str(receipt))
 with log.open('w')as f:p=subprocess.run([str(node),'scripts/diagnose-jobs-startup.mjs'],cwd=r,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=90)
 data=json.loads(receipt.read_text());text=log.read_text();results.append({'mode':mode,'exit':p.returncode,**data,'primaryVisible':'owned_sdk_primary_fault_after_actual_startup'in text,'closeVisible':'owned_sdk_close_fault_after_actual_close'in text,'auditVisible':'owned_sdk_audit_fault_after_actual_zero'in text})
Path('/tmp/native97-sdk-cleanup-baseline-v2-proof.json').write_text(json.dumps({'scope':'Actual unchanged startup-control script with actual SDK transports/SQLite workers. Faults follow successful startup, actual close or real zero audit; no source clone/stub.', 'results':results},indent=2)+'\n');print(json.dumps(results))
