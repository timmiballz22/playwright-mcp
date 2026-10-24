from pathlib import Path
import subprocess,json,os
r=Path('/workspace/playwright-mcp');node=Path('/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node');results=[]
for mode in ['primary','primary_audit']:
 receipt=Path(f'/tmp/native97-codex-baseline-{mode}-receipt.json');log=Path(f'/tmp/native97-codex-baseline-{mode}.log');env=os.environ.copy();env.update(PATH=str(node.parent)+os.pathsep+env['PATH'],NODE_OPTIONS='--import=file:///tmp/native97-codex-cleanup-preload.mjs',OWNED_CODEX_CLEANUP_MODE=mode,OWNED_CODEX_CLEANUP_RECEIPT=str(receipt))
 with log.open('w')as f:p=subprocess.run([str(node),'scripts/verify-codex-jobs.mjs','/tmp/playwright-codex-tools/node_modules/@openai/codex/bin/codex.js'],cwd=r,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=90)
 data=json.loads(receipt.read_text());s=log.read_text();results.append({**data,'exit':p.returncode,'primaryVisible':'owned_codex_primary_after_actual_discovery'in s,'auditVisible':'owned_codex_audit_after_actual_zero'in s})
Path('/tmp/native97-codex-cleanup-baseline-proof.json').write_text(json.dumps({'scope':'Actual Codex app-server0.163 and two real local MCP/SQLite endpoints, zero model turns/browser workflows. Controlled primary fault after both tool inventories validate, optional cleanup fault after actual zero audit; no source clone.', 'results':results},indent=2)+'\n');print(json.dumps(results))
