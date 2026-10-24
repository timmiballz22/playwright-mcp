import pathlib,tempfile,subprocess,json
r=pathlib.Path('/workspace/playwright-mcp');s=(r/'.github/workflows/local-batch.yml').read_text();start=s.index('          # Runner images can indirect');end=s.index('      - run: npx playwright install --with-deps chromium firefox webkit',start);program='\n'.join(line[10:] for line in s[start:end].splitlines()).replace('sudo sed ','sed ')
results=[]
for mode in ['published_mirror_file','legacy_direct','single_azure_mirror','already_canonical','unrelated_uri_tokens']:
 with tempfile.TemporaryDirectory(prefix='ubuntu-mirror-control-') as d:
  base=pathlib.Path(d);sources=base/'sources.list';deb822=base/'ubuntu.sources';mirrors=base/'apt-mirrors.txt';paths={'/etc/apt/sources.list.d/ubuntu.sources':str(deb822),'/etc/apt/sources.list':str(sources),'/etc/apt/apt-mirrors.txt':str(mirrors)}
  text='Types: deb\nURIs: mirror+file:/etc/apt/apt-mirrors.txt\nSuites: noble noble-updates noble-security\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n';deb822.write_text(text)
  if mode=='published_mirror_file':mirrors.write_text('http://azure.archive.ubuntu.com/ubuntu/\tpriority:1\nhttps://archive.ubuntu.com/ubuntu/\tpriority:2\nhttps://security.ubuntu.com/ubuntu/\tpriority:3\n')
  elif mode=='legacy_direct':sources.write_text('deb http://azure.archive.ubuntu.com/ubuntu/ noble main\n')
  elif mode=='single_azure_mirror':mirrors.write_text('http://azure.archive.ubuntu.com/ubuntu/\tpriority:1\n')
  elif mode=='already_canonical':mirrors.write_text('https://archive.ubuntu.com/ubuntu/\tpriority:2\n')
  else:sources.write_text('deb https://packages.microsoft.com/repos/code stable main\ndeb https://azure.archive.ubuntu.com.evil/ubuntu noble main\ndeb https://azure.archive.ubuntu.com:8443/ubuntu noble main\ndeb https://azure.archive.ubuntu.com/ubuntu-extra noble main\ndeb https://private.invalid/?source=http://azure.archive.ubuntu.com/ubuntu noble main\n')
  before={p.name:p.read_bytes() for p in [sources,deb822,mirrors] if p.exists()};script=program
  for old,new in paths.items():script=script.replace(old,new)
  p=subprocess.run(['bash','-euo','pipefail','-c',script],capture_output=True,text=True,timeout=5);assert p.returncode==0,(mode,p.stderr,p.stdout)
  assert deb822.read_text()==text
  if mode=='published_mirror_file':assert mirrors.read_text()=='https://archive.ubuntu.com/ubuntu/\tpriority:2\nhttps://security.ubuntu.com/ubuntu/\tpriority:3\n'
  if mode=='legacy_direct':assert sources.read_text()=='deb https://archive.ubuntu.com/ubuntu/ noble main\n'
  if mode=='single_azure_mirror':assert mirrors.read_text()=='https://archive.ubuntu.com/ubuntu/\tpriority:1\n'
  if mode in ['already_canonical','unrelated_uri_tokens']:assert all(p.read_bytes()==before[p.name] for p in [sources,deb822,mirrors] if p.exists())
  results.append({'case':mode,'exit':p.returncode,'expectedFilesVerified':True,'notice':p.stdout.strip()})
proof={'phase':'Local followup excluded from native90 source58edfce','source':'Exact shell body extracted from workflow; only fixed system paths mapped to owned fixture files and sudo removed','publishedRunnerBlob':'b3f5b2b180df8eb39fcbba034f616e03a69e775c','cases':results,'scope':'Real GNU sed/grep transforms; no local /etc/apt mutation or fake installer pass. Mirror indirection retained; canonical/security fallbacks and signing bytes preserved. Active native configuration and network performance pending. Prior35s success did not prove old step changed indirect URLs.'};pathlib.Path('/tmp/native90-mirror-indirection-proof.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps({'cases':len(results),'allExpected':True}))
