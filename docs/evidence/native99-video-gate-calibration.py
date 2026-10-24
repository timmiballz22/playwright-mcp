from pathlib import Path
import tempfile,json,subprocess,shutil,hashlib
r=Path('/workspace/playwright-mcp');p=Path('/tmp');base=Path(tempfile.mkdtemp(prefix='video-gate-'));results=[];verified=False
try:
 rows=json.loads((p/'native98-wrapper-structured-receipts.json').read_text());chrome=next(x['data'] for x in rows if x['data'].get('fixture')=='owned_video_original_decode_failure' and x['data'].get('project')=='chrome');oldrows=json.loads((r/'docs/evidence/native96-wrapper-structured-receipts.json').read_text());chromium=next(x['data'] for x in oldrows if x['data'].get('fixture')=='owned_video_original_decode_failure' and x['data'].get('project')=='chromium')
 cases=[('actual_chrome',chrome,'chrome',0),('chrome_not_chromium',chrome,'chromium',1),('actual_chromium',chromium,'chromium',0),('chromium_not_chrome',chromium,'chrome',1),('wrong_fixture',{**chrome,'fixture':'untrusted_lookalike'},'chrome',1),('invalid_ready',{**chrome,'ready':'4'},'chrome',1),('invalid_pixel',{**chrome,'pixel':[128,128,128]},'chrome',1),('invalid_project',chrome,'firefox',2)]
 nodes={'20':'/home/agent/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin/node','22':'/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node','24':shutil.which('node')}
 for major,node in nodes.items():
  for name,data,project,expected in cases+[('actual_chrome_ansi',chrome,'chrome',0),('bounded_tail_chrome',chrome,'chrome',0)]:
   text=json.dumps(data)+'\n'
   if name.endswith('_ansi'):text='\x1b[31m'+text.rstrip()+'\x1b[0m\n'
   if name=='bounded_tail_chrome':text=('bounded prefix filler\n'*110000)+text
   (base/'wrapper-tests.log').write_text(text);v=subprocess.run([node,str(r/'scripts/qa/video-control-gate.mjs'),project],cwd=base,capture_output=True,text=True);receipt=json.loads((v.stdout or v.stderr).strip());assert v.returncode==expected,(major,name,v.returncode);assert receipt.get('inspectedBytes',0)<=2*1024*1024;results.append({'nodeMajor':major,'case':name,'exit':v.returncode,'receipt':receipt})
 for name,data in [('actual_chrome',chrome),('actual_chromium',chromium),('actual_chromium_ansi',chromium)]:
  text=json.dumps(data)+'\n'
  if name.endswith('_ansi'):text='\x1b[31m'+text.rstrip()+'\x1b[0m\n'
  (base/'wrapper-tests.log').write_text(text);v=subprocess.run([nodes['24'],str(p/'native99-original-video-gate.cjs')],cwd=base,capture_output=True,text=True);results.append({'baseline':True,'case':name,'exit':v.returncode,'receipt':json.loads(v.stdout)})
 verified=True
finally:
 if verified:shutil.rmtree(base)
 else:print(json.dumps({'fixture':'video_gate_calibration_preserved','workspace':base.name}))
proof={'scope':'Real native98 Chrome gray receipt and native96 Chromium gray receipt, plus explicitly mutated invalid/ANSI/tail calibration inputs. Original732 inline gate extracted unchanged. No browser effect/model turn/native fresh-control acceptance claimed.','sourceSha256':hashlib.sha256((r/'scripts/qa/video-control-gate.mjs').read_bytes()).hexdigest(),'baselineSha256':hashlib.sha256((p/'native99-original-video-gate.cjs').read_bytes()).hexdigest(),'results':results};(p/'native99-video-gate-proof.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps({'currentCases':sum(not x.get('baseline') for x in results),'baselineCases':3,'fixtureRemovedAfterVerified':verified,'baseline':[(x['case'],x['exit']) for x in results if x.get('baseline')]}))
