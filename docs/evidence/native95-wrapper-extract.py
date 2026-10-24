import pathlib,json,re
p=pathlib.Path('/tmp');base=json.loads((p/'native95-wrapper-job-log-exits.json').read_text());retry=json.loads((p/'native95-wrapper-job-log-exits-retry1.json').read_text()) if (p/'native95-wrapper-job-log-exits-retry1.json').exists() else [];resolved={r['jobId']:r for r in base}
for r in retry:
 if r['exit']==0:resolved[r['jobId']]=r
assert all(r['exit']==0 for r in resolved.values());(p/'native95-wrapper.log').write_text(''.join((p/r['file']).read_text() for r in resolved.values()))
receipts=[];fails=[];blocks=[]
for r in resolved.values():
 lines=(p/r['file']).read_text().splitlines()
 for i,line in enumerate(lines):
  msg=re.sub(r'^.*?\d{4}-\d\d-\d\dT\S+Z ?', '',line)
  msg=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', msg)
  if re.search(r'^\s*(?:\d+\) \[|not ok \d+ -)',msg):
   fails.append({'job':r['name'],'test':msg});end=next((j for j in range(i+1,min(len(lines),i+140)) if re.search(r'\bnot ok \d+ -|\s\d+\) \[',re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',lines[j]))),min(len(lines),i+140));blocks.append({'job':r['name'],'lines':lines[i:end]})
  start=msg.find('{')
  if start<0:continue
  try:d=json.JSONDecoder().raw_decode(msg[start:])[0]
  except:continue
  if isinstance(d,dict):receipts.append({'job':r['name'],'data':d})
(p/'native95-wrapper-structured-receipts.json').write_text(json.dumps(receipts,indent=2)+'\n');(p/'native95-wrapper-failure-blocks.json').write_text(json.dumps(blocks,indent=2)+'\n')
print(json.dumps({'failureNameCount':len(fails),'receiptCount':len(receipts)}))
selected=[]
for r in receipts:
 d=r['data']
 if d.get('fixture') in ['owned_video_decoded','owned_video_source_paint','owned_video_decode','owned_media_playback','owned_video_playback'] or ('pixel' in d and ('video' in str(d.get('fixture')))):
  selected.append({'job':r['job'],'data':{k:d[k] for k in ['fixture','project','pixel','width','height','ready','network','error','playbackRequests','rangeRequests','partialResponses'] if k in d}})
(p/'native95-wrapper-video-projection.json').write_text(json.dumps(selected,indent=2)+'\n')
