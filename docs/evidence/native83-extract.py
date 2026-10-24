from pathlib import Path
import json,re
blocks=[];records=[];names=[]
for label in ['batch','wrapper']:
 for r in json.loads(Path(f'/tmp/native83-{label}-job-log-exits.json').read_text()):
  assert r['exit']==0
  lines=Path(f'/tmp/native83-{label}-job-{r["jobId"]}.log').read_text().splitlines()
  for i,l in enumerate(lines):
   msg=re.sub(r'^.*?\d{4}-\d\d-\d\dT\S+Z ?', '',l)
   if re.search(r'\bnot ok \d+ -',l) and '##[error]' not in l:
    end=next((j for j in range(i+1,len(lines)) if '##[error]' not in lines[j] and re.search(r'\b(?:not )?ok \d+ -|# tests \d+',lines[j])),min(len(lines),i+140))
    blocks.append({'job':r['name'],'lines':lines[i:end]});names.append({'job':r['name'],'test':msg})
   start=msg.find('{')
   if start<0:continue
   try:v=json.loads(msg[start:])
   except:continue
   if isinstance(v,dict):records.append({'job':r['name'],'data':v})
Path('/tmp/native83-failure-blocks.json').write_text(json.dumps(blocks,indent=2)+'\n')
Path('/tmp/native83-structured-receipts.json').write_text(json.dumps(records,indent=2)+'\n')
legacy=[r for r in records if r['data'].get('fixture') in ['factory_lifetime_comparison','exact_runner_initial_anchor','original_mcp_lifetime_comparison']]
Path('/tmp/native83-legacy-comparisons.json').write_text(json.dumps(legacy,indent=2)+'\n')
chosen=[r for r in records if r['job'].startswith('codex_client') or r['data'].get('fixture') in ['http_privacy_workspace_preserved','batch_mcp_workspace_preserved','raw_browser_failure','raw_owned_root_exit','original_stderr_budget_probe'] or 'successfulRuns' in r['data']]
Path('/tmp/native83-native-receipts.json').write_text(json.dumps(chosen,indent=2)+'\n')
seen=set();controls=[]
for r in records:
 v=r['data'];key=(r['job'],v.get('mode'))
 if 'successfulRuns' in v and key not in seen:
  seen.add(key);last=v.get('last') or {};controls.append({'job':r['job'],'mode':v['mode'],'ok':v['ok'],'successfulRuns':v['successfulRuns'],'confirmedActions':v['confirmedActions'],'beforeForce':v.get('residualProcessesBeforeForce'),'final':v.get('activeOwnedProcesses'),'last':{k:last[k] for k in ['reason','completed','durationMs','cleanupFailures','failedStep','failureKind'] if k in last}})
Path('/tmp/native83-controls-summary.json').write_text(json.dumps(controls,indent=2)+'\n')
print(json.dumps({'failureNames':names,'receiptCount':len(records),'legacyRecords':len(legacy),'controls':controls}))
