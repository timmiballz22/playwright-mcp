import json,pathlib,re
p=pathlib.Path('/tmp');jobs=json.load(open(p/'native99-batch-job-log-exits.json'));retry=json.load(open(p/'native99-batch-job-log-exits-retry1.json')) if (p/'native99-batch-job-log-exits-retry1.json').exists() else [];resolved={r['jobId']:r for r in jobs}
for r in retry:
 if r['exit']==0:resolved[r['jobId']]=r
races=[]
for r in resolved.values():
 if not r['name'].startswith('journal ('):continue
 s=(p/r['file']).read_text();cases=re.findall(r'(?m)\bok \d+ - schema write lock revalidates the actual concurrent (future_version|cleared_version|deleted_identity) change without repairing it',s);assert sorted(cases)==['cleared_version','deleted_identity','future_version'],(r['name'],cases);races.append({'job':r['name'],'passedActualConnectionRaces':cases})
(p/'native99-native-schema-race-proof.json').write_text(json.dumps(races,indent=2)+'\n')
all_primary=[r for r in json.load(open(p/'native99-structured-receipts.json')) if r['job'].startswith('codex_client') and 'modelTurns' in r['data']];outcomes={j['name']:j['conclusion'] for j in json.load(open(p/'native99-39868413381-rest-jobs.json'))['jobs']};primary=[r for r in all_primary if outcomes.get(r['job'])=='success' and r['data'].get('completed')==1000 and r['data'].get('modelTurns')==0 and r['data'].get('activeOwnedProcesses')==0 and r['data'].get('terminalCleanup') is True and r['data'].get('activeCancel') is True];(p/'native99-primary-client-all-receipts.json').write_text(json.dumps(all_primary,indent=2)+'\n');(p/'native99-primary-client-success-receipts.json').write_text(json.dumps(primary,indent=2)+'\n')
print({'nativeRaceChecks':sum(len(r['passedActualConnectionRaces']) for r in races),'successfulPrimaryClients':len(primary)})
