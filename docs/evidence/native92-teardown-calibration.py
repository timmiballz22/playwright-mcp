import os,subprocess,pathlib,json,re
root=pathlib.Path('/workspace/playwright-mcp');out=pathlib.Path('/tmp');results=[]
for mode in ['healthy','overflow']:
 env=os.environ.copy();env.pop('PLAYWRIGHT_TEST_STDERR_OVERFLOW',None)
 if mode=='overflow':env['PLAYWRIGHT_TEST_STDERR_OVERFLOW']='1'
 with (out/f'native92-teardown-{mode}.log').open('w') as f:p=subprocess.run(['npx','playwright','test','tests/stdio-stderr.spec.ts','--project=chromium'],cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=60)
 s=(out/f'native92-teardown-{mode}.log').read_text();assert p.returncode==(0 if mode=='healthy' else 1),(mode,p.returncode);records=[]
 for line in s.splitlines():
  line=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',line).strip()
  try:d=json.loads(line)
  except ValueError:continue
  if isinstance(d,dict) and d.get('fixture')=='original_mcp_teardown':records.append(d)
 if mode=='healthy':assert not records
 else:
  assert len(records)==1 and records[0]['stderr'][0]['overflow'] is True and records[0]['stderr'][0]['retainedBytes']==1048576 and records[0]['truncated'] is False
  assert 'private-fixture-stderr-canary:' not in json.dumps(records[0])
 results.append({'mode':mode,'exit':p.returncode,'teardownReceipts':records})
proof={'phase':'Local fixture diagnostic followup excluded from native92 source6884c4a','cases':results,'scope':'Actual original stdio MCP handshake and pinned SDK; existing real stderr-flood producer, not a mocked transport. Overflow intentionally fails and remains a negative calibration, not a passed production/native test. EOF assertion and SDK close budgets unchanged; actual EOF-unconfirmed path awaits native.'};(out/'native92-teardown-calibration-proof.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps({'healthyExit':results[0]['exit'],'overflowExit':results[1]['exit'],'boundedFailureReceiptVerified':True}))
