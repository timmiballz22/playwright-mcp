import subprocess,json,pathlib,concurrent.futures,time

def check(rid):
 out={'run':rid}
 for suffix,kind in [('', 'run'),('/jobs?per_page=100','jobs')]:
  try:p=subprocess.run(['gh','api',f'repos/timmiballz22/playwright-mcp/actions/runs/{rid}'+suffix],capture_output=True,text=True,timeout=20)
  except subprocess.TimeoutExpired:out[kind+'Read']='timeout';continue
  if p.returncode:out[kind+'ReadExit']=p.returncode;continue
  d=json.loads(p.stdout);pathlib.Path(f'/tmp/native101-{rid}-rest-{kind}.json').write_text(p.stdout)
  pathlib.Path(f'/tmp/native101-{rid}-snapshot-{time.time_ns()}-{kind}.json').write_text(p.stdout)
  if kind=='run':out.update(status=d['status'],conclusion=d['conclusion'])
  else:out['jobs']=[{'id':j['id'],'name':j['name'],'status':j['status'],'conclusion':j['conclusion'],'currentStep':next((s['name'] for s in j['steps'] if s['status']=='in_progress'),None)} for j in d['jobs']]
 return out
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as e:
 for d in e.map(check,[39875726404,39875726421]):
  js=d.pop('jobs',[]);d['completed']=sum(j['status']=='completed' for j in js);d['failed']=[j['name'] for j in js if j['conclusion']=='failure'];d['active']=[{'name':j['name'],'step':j['currentStep']} for j in js if j['status']!='completed'];print(json.dumps(d))
