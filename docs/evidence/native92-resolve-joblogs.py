from pathlib import Path
import json
p=Path('/tmp');base=json.load(open(p/'native92-batch-job-log-exits.json'));r={x['jobId']:x for x in base}
for x in json.load(open(p/'native92-batch-job-log-exits-retry1.json')):
 if x['exit']==0 and x['bytes']:r[x['jobId']]=x
assert all(x['exit']==0 and x['bytes'] for x in r.values());(p/'native92-batch.log').write_text(''.join((p/x['file']).read_text() for x in r.values()));print({'resolvedBatchLogs':len(r),'firstReadEOF':sum('EOF' in str(x.get('error')) for x in base)})
