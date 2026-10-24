import json,pathlib,re,datetime
p=pathlib.Path('/tmp');entries=[]
for label in ['batch','wrapper']:
 rs={r['jobId']:r for r in json.load(open(p/f'native99-{label}-job-log-exits.json'))};retry=p/f'native99-{label}-job-log-exits-retry1.json'
 if retry.exists():
  for r in json.load(open(retry)):
   if r['exit']==0 and r['bytes']:rs[r['jobId']]=r
 entries.extend(rs.values())
mirrors=[];checkpoints=[]
for r in entries:
 s=(p/r['file']).read_text();m=re.findall(r'##\[notice\]changedFiles=(\d+) remainingMatchedAzureEntries=(\d+)',s)
 if m:mirrors.append({'job':r['name'],'changedFiles':int(m[0][0]),'remainingMatchedAzureEntries':int(m[0][1])})
 if r['name'].startswith('batch ('):checkpoints.append({'job':r['name'],'rawCheckpoints':sorted(set(map(int,re.findall(r'##\[notice\]completedTestNumber=(\d+)',s)))),'rawBootstrapPhases':sorted(set(re.findall(r'##\[notice\]phase=(dependencies|browsers|tests)',s)))})
assert len(mirrors)==6 and all(x['changedFiles']==1 and x['remainingMatchedAzureEntries']==0 for x in mirrors),mirrors
(p/'native99-shared-mirror-native-proof.json').write_text(json.dumps({'scope':'Six native Linux runner instances across the four normal host browser-install job paths. Fifth configured path (functional soak) is opt-in and unexecuted. Exactly one targeted file changed per instance; actual file identity not logged. No isolated timing/cause guarantee or Docker image source rewrite claimed.','observations':mirrors},indent=2)+'\n');(p/'native99-checkpoint-phase-proof.json').write_text(json.dumps(checkpoints,indent=2)+'\n')
jobs=json.load(open(p/'native99-39868413381-rest-jobs.json'))['jobs'];installs=[]
for j in jobs:
 if j['name'].startswith('batch (ubuntu'):
  s=next(s for s in j['steps'] if s['name']=='Run npx playwright install --with-deps chromium firefox webkit');dt=lambda x:datetime.datetime.fromisoformat(x.replace('Z','+00:00'));installs.append({'job':j['name'],'durationSeconds':int((dt(s['completed_at'])-dt(s['started_at'])).total_seconds()),'conclusion':s['conclusion']})
(p/'native99-linux-install-proof.json').write_text(json.dumps(installs,indent=2)+'\n')
rs=json.load(open(p/'native99-structured-receipts.json'));factory=[r for r in rs if r['data'].get('fixture') in ['factory_lifetime_scoped_failure','factory_lifetime_orphan','factory_lifetime_comparison']];(p/'native99-full-factory-observations.json').write_text(json.dumps(factory,indent=2)+'\n')
print({'mirrorInstances':len(mirrors),'factoryObservations':len(factory)})
