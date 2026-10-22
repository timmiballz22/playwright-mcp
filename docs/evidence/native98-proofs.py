from pathlib import Path
import json,re,collections
p=Path('/tmp');source='732c913b144bee6010bbb4febf63089c30ba4dfd';rs=json.loads((p/'native98-structured-receipts.json').read_text());wr=json.loads((p/'native98-wrapper-structured-receipts.json').read_text());bs=json.loads((p/'native98-failure-blocks.json').read_text())
def save(name,value):(p/name).write_text(json.dumps(value,indent=2)+'\n')
def text(lines):return [re.sub(r'^.*?\d{4}-\d\d-\d\dT\S+Z ?', '',x) for x in lines]
def objects(lines):
 out=[]
 for l in lines:
  i=l.find('{')
  if i<0:continue
  try:d=json.JSONDecoder().raw_decode(l[i:])[0]
  except:continue
  if isinstance(d,dict):out.append(d)
 return out
components=[];main=[];ownership=[]
for b in bs:
 ls=text(b['lines']);title=ls[0]
 if b['job']=='journal (windows-latest, 22)':
  m=re.search(r'testNumber=(\d+) failureClass=(\w+) durationMs=(\d+) journalFailure=(\w+) journalCommand=(\w+) journalInitStage=(\w+) journalExitConfirmed=(true|false)','\n'.join(ls))
  if m:components.append({'test':title,'testNumber':int(m[1]),'failureClass':m[2],'durationMs':int(m[3]),'journalFailure':m[4],'journalCommand':m[5],'journalInitStage':m[6],'journalExitConfirmed':m[7]=='true'})
 if b['job'].startswith('batch ('):
  ds=objects(ls);projections=[]
  for d in ds:
   if 'job' in d:
    projections.append({'job':d['job'],'result':d.get('result'),'ready':d.get('ready')})
   elif any(k in d for k in ['ok','reason','completed','failedStep']):projections.append(d)
  main.append({'job':b['job'],'test':title,'facts':projections,'fixedErrorLines':[l for l in ls[:35] if 'SyntaxError:' in l or 'expected:' in l or 'actual:' in l]})
 if b['job']=='batch (windows-latest, 22)' and 'committed POST' in title:
  ids=[int(m.group(1)) for l in ls for m in [re.match(r'    \d+: (\d+)$',l)] if m];assert ids==[5520,6136,6452,6484],ids
  ownership=ids
assert len(components)==2
save('native98-component-init-timeouts-proof.json',{'source':source,'scope':'Both guardian cancel/disconnect tests fail in initial setup before those scenario semantics run. Real init rpc_timeout at last observed schema_commit, actual owned-worker close confirmed. Phase is a lower bound; COMMIT completion and OS cause are not established. No DB/key exported. Prospective retry is not in this source.','failures':components})
save('native98-main-failure-projection.json',main)
save('native98-private-fetch-ownership-proof.json',{'source':source,'job':'batch (windows-latest, 22)','reportedPossibleSurvivors':ownership,'scope':'The unchanged legacy/root-PID absence assertion reports four IDs after Firefox cancellation-witness body assertions pass. No same-snapshot full rows/root births were logged by this fixture. Keep all four unclassified/unresolved; no role/name/age/window filtering, PID-based signal, lease/debt or retrospective clearance. Later zero observations do not clear them.','witnessReceipts':[r['data'] for r in rs if r['job']=='batch (windows-latest, 22)' and r['data'].get('component')=='private_fetch_cancel_witness' and r['data'].get('browser')=='firefox']})
viewport=[r for r in rs if r['data'].get('fixture')=='chromium_viewport_first_input'];save('native98-viewport-native-failure-proof.json',{'source':source,'scope':'Two strict first-JPEG assertions fail despite completed request ordering. Other lanes pass this sample; no general capture guarantee.','failures':viewport})
frames=[r for r in wr if r['data'].get('fixture')=='owned_video_encoder_input'];sizes=collections.Counter(f'{r["data"]["width"]}x{r["data"]["height"]}' for r in frames);short=[r for r in frames if r['data']['width']!=320 or r['data']['height']!=240]
video={'source':source,'scope':'Actual original recorder-input SOF headers forwarded unchanged. Chrome gray failure includes short input; fresh gate only selects Chromium in this source, so Chrome fresh controls are not run. Full raw adjacency/independent encoded frame0 receipts retained. This is not measured window-bound/cause/fix evidence.','inputFrameRecords':len(frames),'sizeCounts':dict(sizes),'shortInputs':short,'sourceAndDecodeReceipts':[r for r in wr if r['job']=='test (macos-15-intel)' and r['data'].get('project')=='chrome' and r['data'].get('fixture') in ['owned_video_source_paint','owned_video_original_decode_failure','owned_video_independent_first_frame']],'gateReceipts':[r for r in wr if r['data'].get('fixture')=='video_first_frame_control_gate']};save('native98-video-input-native-proof.json',video)
orig={'source':source,'scope':'Original native98 completed summaries, not future fixture fixes. Chrome gray, Windows WebKit media, and two Windows legacy controls remain failed. Firefox trusted-code original cases pass this sample.','counts':json.loads((p/'native98-wrapper-counts.json').read_text()),'stockPCM':[r for r in wr if r['data'].get('fixture')=='stock_pcm_reference'],'decodedFrames':[r for r in wr if r['data'].get('fixture')=='owned_webm_frame'],'diagnosticVideo':video,'legacyFailures':[b for b in json.loads((p/'native98-wrapper-failure-blocks.json').read_text()) if 'Exercise legacy' in b['lines'][0]]};save('native98-original-diagnostic-projection.json',orig)
clients=[r for r in rs if 'modelTurns' in r['data'] and r['data'].get('completed')==1000 and (r['job'].startswith('codex_client') or r['job']=='codex_journal_diagnostic')];save('native98-native-client-summary-proof.json',{'source':source,'scope':'Three primary actual-client successes and one separate fresh macOS instrumented control. The latter is outside test-summary counts and is not a profile of a previous failed host.','receipts':clients})
f=p/'native98-journal-qa-native-proof.json';d=json.loads(f.read_text());d['source']=source;d['clientReceipt']=next(r['data'] for r in clients if r['job']=='codex_journal_diagnostic');f.write_text(json.dumps(d,indent=2)+'\n')
print(json.dumps({'componentInitFailures':len(components),'viewportFailures':len(viewport),'unclassifiedPossibleSurvivors':ownership,'videoHeaders':len(frames),'sizes':dict(sizes),'primaryAndSeparateClientSuccesses':len(clients)}))
