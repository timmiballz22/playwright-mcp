import json,urllib.request,urllib.error,concurrent.futures,pathlib,time
urls=json.load(open('/tmp/native95-doc-external-targets.json'))
def check(url):
 started=time.monotonic()
 try:
  with urllib.request.urlopen(urllib.request.Request(url,method='HEAD',headers={'User-Agent':'local-playwright-doc-link-check'}),timeout=5) as r:
   return {'url':url,'status':r.status,'finalUrl':r.url,'elapsedMs':round((time.monotonic()-started)*1000)}
 except urllib.error.HTTPError as e:return {'url':url,'status':e.code,'elapsedMs':round((time.monotonic()-started)*1000)}
 except Exception as e:return {'url':url,'status':None,'failure':type(e).__name__,'elapsedMs':round((time.monotonic()-started)*1000)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(check,urls))
pathlib.Path('/tmp/native95-doc-external-proof.json').write_text(json.dumps({'scope':'45 unique explicit HTTPS inline Markdown links in25 top-level docs, GitHub only. Unauthenticated HEAD with normal TLS and redirects; five-second per-request bound, three concurrent. No body read, credentials, API workaround, external content review or full Markdown-parser guarantee.','results':results},indent=2)+'\n')
from collections import Counter
print(json.dumps({'targets':len(results),'statuses':dict(Counter(str(x['status']) for x in results))}))
