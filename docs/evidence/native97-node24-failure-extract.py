from pathlib import Path
import json,re
p=Path('/tmp');f=p/'native97-failure-blocks.json';blocks=json.loads(f.read_text());entries=json.loads((p/'native97-batch-job-log-exits.json').read_text());x=next(x for x in entries if x['name']=='batch (ubuntu-latest, 24)');ls=(p/x['file']).read_text().splitlines();matches=[i for i,l in enumerate(ls) if '✖ real full Chromium applies device metrics' in l and '##[error]' not in l];assert matches;i=matches[-1]
if not any(b['job']==x['name'] for b in blocks):blocks.append({'job':x['name'],'lines':ls[i:i+40],'scope':'Node24 spec-reporter failure footer; TAP-only extractor omitted this failure. Completed test counts already included it.'})
f.write_text(json.dumps(blocks,indent=2)+'\n');print(json.dumps({'failureBlocks':len(blocks),'node24Added':True}))
