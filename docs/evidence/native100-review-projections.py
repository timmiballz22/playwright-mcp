from pathlib import Path
import json,re,collections
p=Path('/tmp');source='b2cbc636f4188e3a9bbea335b2908a779f578f57';rs=json.loads((p/'native100-structured-receipts.json').read_text());wr=json.loads((p/'native100-wrapper-structured-receipts.json').read_text());bs=json.loads((p/'native100-failure-blocks.json').read_text())
selected=[];overview=[]
for b in bs:
 lines=[x.split('Z ',1)[-1] for x in b['lines']];name=next((l for l in lines if 'not ok ' in l or '✖ ' in l),'');objects=[]
 for line in lines:
  t=line.strip()
  if t.startswith('{'):
   try:objects.append(json.loads(t))
   except ValueError:pass
 row={'job':b['job'],'name':name,'objects':objects,'expectedActualLines':[l for l in lines if re.match(r'\s*[+-] ',l)]};selected.append(row)
 scalars=[]
 for d in objects:
  result=d.get('result',d);failed=result.get('failedStep') or {};e=result.get('execution',{});scalars.append({k:v for k,v in {'reason':result.get('reason'),'completed':result.get('completed'),'total':result.get('total'),'durationMs':result.get('durationMs'),'failedIndex':failed.get('index'),'failureKind':failed.get('failureKind'),'cleanup':e.get('cleanup'),'tempCleanup':e.get('tempCleanup'),'freshRun':d.get('freshRun'),'requestCount':d.get('requestCount')}.items() if v is not None})
 overview.append({'job':b['job'],'name':name[:140],'facts':scalars,'expectedActual':row['expectedActualLines'][:3]})
proof={'source':source,'scope':'Exact failed cases and parseable emitted objects, original raw terminal logs remain authoritative. No absent fields inferred. Three Windows journal tests fail before their intended injected phase or during the recovery open; no deadline/retry widening justified. Later healthy samples never clear old Windows identities/exits.','failures':selected,'viewport':[r for r in rs if r['data'].get('fixture')=='chromium_viewport_first_input'],'privacy':[r for r in rs if r['data'].get('fixture')=='http_privacy_workspace_preserved'],'primaryMac':[r for r in rs if r['job']=='codex_client (macos-15-intel)' and (r['data'].get('phase')=='codex_primary_job' or r['data'].get('fixture')=='codex_client_workspace_retention')],'actualClients':[r for r in rs if 'modelTurns' in r['data'] and r['data'].get('completed')==1000],'allFactoryObservations':[r for r in rs if r['data'].get('fixture')=='factory_lifetime_comparison'],'originalTeardown':[r for r in wr if r['data'].get('fixture')=='original_mcp_teardown']}
(p/'native100-terminal-review-proof.json').write_text(json.dumps(proof,indent=2)+'\n');(p/'native100-failure-scalar-projection.json').write_text(json.dumps(overview,indent=2)+'\n')
for r in overview:print(json.dumps(r))
print(json.dumps({'witnessContexts':len({(r['job'],r['data'].get('browser'),r['data'].get('scenario')) for r in rs if r['data'].get('component')=='private_fetch_cancel_witness'}),'videoInputs':sum(r['data'].get('fixture')=='owned_video_encoder_input' for r in wr),'videoDecodes':sum(r['data'].get('fixture')=='owned_webm_frame' for r in wr)}))
