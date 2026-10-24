from pathlib import Path
import json,re
p=Path('/tmp');entries=json.loads((p/'native101-batch-job-log-exits.json').read_text());retry=p/'native101-batch-job-log-exits-retry1.json'
if retry.exists():entries+=json.loads(retry.read_text())
r=next((x for x in reversed(entries) if x['name']=='batch (ubuntu-latest, 24)' and not x['exit']),None)
assert r,'resolved_node24_log_required'
lines=(p/r['file']).read_text().splitlines();plain=[re.sub(r'^.*?\d{4}-\d\d-\d\dT\S+Z ?', '',re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',l)) for l in lines];start=next((i for i,l in enumerate(plain) if l.strip()=='✖ failing tests:'),len(lines));indices=[i for i in range(start+1,len(lines)) if plain[i].lstrip().startswith('✖ ') and '##[error]' not in plain[i]]
f=p/'native101-failure-blocks.json';blocks=json.loads(f.read_text());added=0
for n,i in enumerate(indices):
 title=plain[i].strip()
 if any(b['job']==r['name'] and title in b['lines'][0] for b in blocks):continue
 end=indices[n+1] if n+1<len(indices) else len(lines);blocks.append({'job':r['name'],'lines':lines[i:min(end,i+120)],'scope':'Node24 spec-reporter failure footer; TAP-only extraction can omit these cases. Completed counts remain separate.'});added+=1
f.write_text(json.dumps(blocks,indent=2)+'\n');print(json.dumps({'addedNode24FooterBlocks':added,'allFailureBlocks':len(blocks)}))
