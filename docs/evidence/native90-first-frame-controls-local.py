import pathlib,subprocess,os,json,hashlib,re
r=pathlib.Path('/workspace/playwright-mcp');output=r/'test-results';before={}
for p in output.rglob('owned-frame.webm'):
 if 'first-frame-controls' not in p.relative_to(output).parts:
  stat=p.stat();before[str(p)]=(hashlib.sha256(p.read_bytes()).hexdigest(),stat.st_ino,stat.st_mtime_ns)
assert before,'Original local recordings required for retention control'
env=dict(os.environ,PLAYWRIGHT_TEST_VIDEO_COLOR_DIAGNOSTICS='1');log=pathlib.Path('/tmp/native90-first-frame-controls-local24.log')
with log.open('w') as f:p=subprocess.run(['node','node_modules/@playwright/test/cli.js','test','tests/video-playback.spec.ts','--project=chromium','--repeat-each=3','--workers=1','--output=test-results/first-frame-controls'],cwd=r,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=180)
assert p.returncode==0,p.returncode
for name,facts in before.items():
 file=pathlib.Path(name);stat=file.stat();assert (hashlib.sha256(file.read_bytes()).hexdigest(),stat.st_ino,stat.st_mtime_ns)==facts
records=[]
for line in log.read_text().splitlines():
 line=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',line);i=line.find('{')
 if i<0:continue
 try:d=json.loads(line[i:])
 except:continue
 if isinstance(d,dict):records.append(d)
frames=[d for d in records if d.get('fixture')=='owned_video_independent_first_frame'];assert len(frames)==3 and all(d.get('sampled') is True for d in frames)
for frame in frames:
 for point in frame['points']:
  if (point['x'],point['y']) in [(100,100),(319,239)]:
   red,green,blue,alpha=point['pixel'];assert red>=230 and green<=20 and blue<=20 and alpha==255
controls=[d for d in records if d.get('fixture')=='owned_video_color_metadata_controls'];assert len(controls)==3;assert all(len(d.get('controls',[]))==3 and not d.get('probeFailed',False) for d in controls)
proof={'phase':'Local controlled fresh recordings excluded from native90','node':24,'project':'chromium','strictFreshCases':3,'exit':p.returncode,'independentFirstFrameSamples':len(frames),'metadataCopiesPerCase':3,'originalRecordingFilesUnchangedBytesInodesTimestamps':len(before),'output':'Nested separate Playwright output directory retains original records','scope':'All strict original pixel/counter assertions remain. No seek/skip, failed click replay, deadline increase or producer fix. These healthy Linux controls do not explain the original Mac gray sample.'};pathlib.Path('/tmp/native90-first-frame-controls-local-proof.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
