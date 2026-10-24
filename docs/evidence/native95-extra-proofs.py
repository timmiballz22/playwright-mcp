import json,pathlib,re
p=pathlib.Path('/tmp');jobs=json.load(open(p/'native95-batch-job-log-exits.json'));retry=json.load(open(p/'native95-batch-job-log-exits-retry1.json')) if (p/'native95-batch-job-log-exits-retry1.json').exists() else [];resolved={r['jobId']:r for r in jobs}
for r in retry:
 if r['exit']==0:resolved[r['jobId']]=r
races=[]
for r in resolved.values():
 if not r['name'].startswith('journal ('):continue
 s=(p/r['file']).read_text();cases=re.findall(r'(?m)\bok \d+ - schema write lock revalidates the actual concurrent (future_version|cleared_version|deleted_identity) change without repairing it',s);assert sorted(cases)==['cleared_version','deleted_identity','future_version'],(r['name'],cases);races.append({'job':r['name'],'passedActualConnectionRaces':cases})
(p/'native95-native-schema-race-proof.json').write_text(json.dumps(races,indent=2)+'\n')
primary=[r for r in json.load(open(p/'native95-structured-receipts.json')) if r['job'].startswith('codex_client') and 'modelTurns' in r['data']];(p/'native95-primary-client-success-receipts.json').write_text(json.dumps(primary,indent=2)+'\n')
print({'nativeRaceChecks':sum(len(r['passedActualConnectionRaces']) for r in races),'successfulPrimaryClients':len(primary)})
