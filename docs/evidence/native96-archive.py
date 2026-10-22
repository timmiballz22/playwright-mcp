from pathlib import Path
import json,shutil,hashlib
p=Path('/tmp');dest=Path('/workspace/playwright-mcp/docs/evidence');runs={'batch':39842071053,'original':39842070912}
source=None
for label,rid in runs.items():
 run=json.loads((p/f'native96-{rid}-rest-run.json').read_text());jobs=json.loads((p/f'native96-{rid}-rest-jobs.json').read_text())['jobs'];assert run['status']=='completed' and all(j['status']=='completed' for j in jobs)
 source=source or run['head_sha'];assert source==run['head_sha']
patterns=['native96-*-job-*.log','native96-*-job-log-exits*.json','native96-*-rest-*.json','native96-*-snapshot-*.json','native96-*-annotations-*.json','native96-*-counts.json','native96-structured-receipts.json','native96-wrapper-structured-receipts.json','native96-failure-blocks.json','native96-wrapper-failure-blocks.json','native96-legacy-comparisons.json','native96-controls-summary.json','native96-native-receipts.json','native96-primary-client-success-receipts.json','native96-primary-client-all-receipts.json','native96-primary-windows-failure-proof.json','native96-native-schema-race-proof.json','native96-full-factory-observations.json','native96-shared-mirror-native-proof.json','native96-checkpoint-phase-proof.json','native96-linux-install-proof.json','native96-main-failure-projection.json','native96-video-proof.py','native96-video-input-native-proof.json','native96-original-diagnostic-projection.json','native96-archive.py','native96-poll.py','native96-collect-completed.py','native96-extract.py','native96-wrapper-extract.py','native96-observations.py','native96-extra-proofs.py','native96-annotations.py']
files={f for pattern in patterns for f in p.glob(pattern) if f.is_file()}
counts={label:json.loads((p/f'native96-{label}-counts.json').read_text()) for label in ['batch','wrapper']}
reads=[]
for label in ['batch','wrapper']:
 first=json.loads((p/f'native96-{label}-job-log-exits.json').read_text());retry=p/f'native96-{label}-job-log-exits-retry1.json';again=json.loads(retry.read_text()) if retry.exists() else [];resolved={r['jobId']:r for r in first}
 for r in again:
  if r['exit']==0 and r['bytes']:resolved[r['jobId']]=r
 assert all(r['exit']==0 and r['bytes'] for r in resolved.values());reads.append({'label':label,'firstAttempted':len(first),'firstSucceededNonempty':sum(r['exit']==0 and r['bytes']>0 for r in first),'retryAttempted':len(again),'resolvedNonempty':len(resolved)})
package=[]
for j in json.loads((p/'native96-39842071053-rest-jobs.json').read_text())['jobs']:
 for s in j['steps']:
  if s['name']=='Verify installed production package':package.append({'job':j['name'],'conclusion':s['conclusion']})
for f in files:shutil.copy2(f,dest/f.name)
primary_jobs=[{'job':j['name'],'conclusion':j['conclusion']} for j in json.loads((p/'native96-39842071053-rest-jobs.json').read_text())['jobs'] if j['name'].startswith('codex_client')]
summary={'primaryClientJobs':primary_jobs,'source':source,'runs':runs,'completedSummaries':{label:{key:counts[label][key] for key in ['pass','fail','skipped','cancelled']} for label in counts},'total':{key:sum(c[key] for c in counts.values()) for key in ['pass','fail','skipped','cancelled']},'installedPackageSteps':package,'logReads':reads,'scope':'All counts come from completed log summaries; extra fresh controls and legacy cases stay separate in group counts. This native source includes9f975 screenshot retry and ordered viewport setup; it does not include later local retention/diagnostic guards or stronger first-JPEG test. Ordered setup alone does not eliminate native320x98 input; experimental146 headless changes failed local checks and are rejected/restored, not shipped. First log failures/partial attempts are preserved. Full process observations confer no kill/lease/clearance authority. See diagnostic projection and execution ledger for failures, omissions and unsupported features.','archiveSha256':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(files)}}
(dest/'native96-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({'archiveFiles':len(files),'bytes':sum(f.stat().st_size for f in files),'total':summary['total']}))
