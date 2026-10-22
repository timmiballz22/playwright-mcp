import json,pathlib,subprocess,concurrent.futures,time,re
jobs=json.load(open('/tmp/native98-39859258163-rest-jobs.json'))['jobs'];selected=[j for j in jobs if j['name'].startswith('batch (')]
def check(j):
 try:p=subprocess.run(['gh','api',f'repos/timmiballz22/playwright-mcp/check-runs/{j["id"]}/annotations?per_page=100'],capture_output=True,text=True,timeout=20)
 except subprocess.TimeoutExpired:return {'job':j['name'],'read':'timeout'}
 if p.returncode:return {'job':j['name'],'exit':p.returncode}
 a=json.loads(p.stdout);pathlib.Path(f'/tmp/native98-{j["id"]}-annotations-{time.time_ns()}.json').write_text(p.stdout)
 text='\n'.join(x.get('message','') for x in a)
 return {'job':j['name'],'annotations':len(a),'checkpoints':sorted(set(int(n) for n in re.findall(r'completedTestNumber[=": ]+(\d+)',text))),'phases':sorted(set(re.findall(r'phase=(dependencies|browsers|tests)',text))),'changedFiles':re.findall(r'changedFiles=(\d+)',text),'failureAnnotations':sum(x.get('annotation_level')=='failure' for x in a)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as e:
 for result in e.map(check,selected):print(json.dumps(result))
