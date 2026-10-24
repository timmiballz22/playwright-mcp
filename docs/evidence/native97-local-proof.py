from pathlib import Path
import json,shutil,re,hashlib
p=Path('/tmp');d=Path('/workspace/playwright-mcp/docs/evidence');r=Path('/workspace/playwright-mcp')
sdk=[]
for label in ['fixed22','fixed24-r1']:
 data=json.load(open(p/f'native97-sdk-cleanup-{label}-proof.json'))['results']
 for row in data:
  text=(p/f"native97-sdk-{label}-{row['mode']}.log").read_text();row['primaryVisible']='Error: owned_sdk_primary_fault_after_actual_startup'in text;row['closeVisible']='Error: owned_sdk_close_fault_after_actual_close'in text;row['auditVisible']='Error: owned_sdk_audit_fault_after_actual_zero'in text
  assert row['exit']==(0 if row['mode']=='healthy'else 1)
  assert all(x['exists']==(row['mode']!='healthy')for x in row['directories'])
  if row['mode']=='primary_close':assert row['primaryVisible']and row['closeVisible']
  if row['mode']=='primary_audit':assert row['primaryVisible']and row['auditVisible']
 sdk.extend(data)
codex=[]
for label in ['fixed22','fixed24']:
 data=json.load(open(p/f'native97-codex-cleanup-{label}-proof.json'))['results']
 for row in data:
  assert row['exit']==1 and row['primaryVisible'] and row['appServerCloseObserved'] and all(x['exists']for x in row['directories'])
  if row['mode']=='primary_audit':assert row['auditVisible']
 codex.extend(data)
healthy=[]
for line in (p/'native97-codex-healthy24.log').read_text().splitlines():
 if line.startswith('{'):
  try:v=json.loads(line)
  except:continue
  if v.get('completed')==1000:healthy.append(v)
assert len(healthy)==1 and healthy[0]['modelTurns']==0 and healthy[0]['activeOwnedProcesses']==0 and healthy[0]['terminalCleanup'] and healthy[0]['activeCancel']
group=[]
for name in ['native97-group-retention-ns-fixed-proof.json','native97-group-retention-ns-node20-proof.json']:group.extend(json.load(open(p/name))['results'])
assert len(group)==6 and all(x['exit']==(1 if x['mode']=='fault'else 0)and all(y['exists']==(x['mode']=='fault')for y in x['directories'])for x in group)
core=hashlib.sha256((r/'node_modules/playwright-core/lib/coreBundle.js').read_bytes()).hexdigest();assert core=='9f9750ae24604e2099e1c1f6564d5d6cb3d19d30dfbc8b5ec61ba18c0989e25a'
summary={'core':core,'scope':'Actual real-module fixture/control executions. Controlled faults occur after real startup/close/audit effects; not native Windows/macOS cause or IO repair. No source clones, mocked browser effects, raised limits, unsafe replay or authority from process hints. PID namespaces are actual local Linux calibration environments, not production isolation.','sdkFixedExecutions':sdk,'codexFixedNegativeExecutions':codex,'codexHealthyNode24':healthy[0],'groupNamespaceExecutions':group,'fullHostGroupValidation':'Blocked by actual21410-row ps snapshot vs unchanged16384-row cap; invalid_snapshot retained. Fresh namespace healthy path passes; no filtering or cap increase. Native96 Mac cause remains unknown.','baselineCorrection':'Use codex baseline-v2 Error-header scoring, excluding source-code echoes. SDK baseline first two cases valid; its original third hook ran too early, corrected audit case is baseline-v2. Wrong /usr/bin/node fixed24 attempt did not execute; actual fixed24-r1 is used.','nativeScope':'All guards added after native96 sourcecc9562b; source9f975 browser remains unchanged. Failed fixture files stay on executing host; no database/key contents exported.'}
(d/'native97-local-fixture-guards-proof.json').write_text(json.dumps(summary,indent=2)+'\n')
patterns=['native97-sdk-*','native97-codex-*','native97-group-*','native97-final-frozen-*','native97-rejected-headless-experiment.patch','native97-calibrations*.log','native97-headless-patch-identity.json','native97-headless-prepare.log','native97-visible-flag-*','native97-set-visible-size-*','native97-restore-reviewed-core.log','native97-pid-namespace-check.log']
files={f for pat in patterns for f in p.glob(pat)if f.is_file()}
for f in files:shutil.copy2(f,d/f.name)
rejected={'experiment':'Unshipped146 headless-window branch','preparedCore':'146b03adb15d6b92730212ee3160041624719a39af9aa378ad540c5dd8fde4d2','shipped':False,'restoredCore':core,'reason':'Local first JPEG320x180 while requested/metadata320x240, plus a display-free headed-branch attempt actually stayed headless and did not exercise headed behavior. No native headed GUI verification claimed.','attemptedCorrections':'Repeated explicit dontSetVisibleSize:false and direct Emulation.setVisibleSize controls gave mixed first-frame geometry; neither is a reliable source fix. Original first-frame assertions remain strict.','scope':'A separate controlled short-visible-surface intervention can turn gray to red; it does not prove a general resize/start-recording fix. No warmup, frame discard, seek, encoder change or new default channel/transport ships.'};(d/'native97-rejected-browser-experiments.json').write_text(json.dumps(rejected,indent=2)+'\n')
print(json.dumps({'sdkExecutions':len(sdk),'codexNegatives':len(codex),'codexHealthySteps':healthy[0]['completed'],'codexHealthyMs':healthy[0]['durationMs'],'namespaceGroupExecutions':len(group),'copiedFiles':len(files)}))
