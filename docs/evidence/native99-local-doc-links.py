import pathlib,re,json,unicodedata,urllib.parse
root=pathlib.Path('/workspace/playwright-mcp');docs=sorted((root/'docs').glob('*.md'))+[root/'docs/evidence/native97-chromium-capture-repro.md'];cache={}
def clean(s):
 return re.sub(r'```[^\n]*\n.*?```|~~~[^\n]*\n.*?~~~','',s,flags=re.S)
def anchors(p):
 if p not in cache:
  seen={};values=set();s=clean(p.read_text())
  for line in s.splitlines():
   m=re.match(r'^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$',line)
   if not m:continue
   t=re.sub(r'<[^>]+>','',m[1]);t=re.sub(r'\[([^]]+)\]\([^)]*\)',r'\1',t);t=t.replace('`','').replace('*','').replace('_','')
   t=''.join(c for c in t.lower() if c in ' -_' or unicodedata.category(c)[0] in 'LN');slug=t.replace(' ','-');n=seen.get(slug,0);seen[slug]=n+1;values.add(slug+('-'+str(n) if n else ''))
  values.update(re.findall(r'<a\s+(?:name|id)=["\x27]([^"\x27]+)',s));cache[p]=values
 return cache[p]
issues=[];count=0;anchorcount=0;external=0
for p in docs:
 s=clean(p.read_text());definitions=dict(re.findall(r'^\s*\[([^]]+)\]:\s*<?([^\s>]+)>?',s,re.M));links=re.findall(r'!?\[[^]\n]*\]\(<?([^\s)>]+)>?(?:\s+[^)]*)?\)',s)
 for label in re.findall(r'\[[^]\n]+\]\[([^]\n]+)\]',s):
  if label not in definitions:issues.append({'source':p.name,'kind':'undefined_reference','target':label})
  else:links.append(definitions[label])
 for target in links:
  if re.match(r'^[a-z][a-z0-9+.-]*:',target,re.I) or target.startswith('//'):external+=1;continue
  path,_,anchor=urllib.parse.unquote(target).partition('#');dest=(p.parent/path).resolve() if path else p;count+=1
  if not dest.exists():issues.append({'source':p.name,'kind':'missing_file','target':target});continue
  if anchor and dest.suffix.lower()=='.md':
   anchorcount+=1
   if anchor not in anchors(dest):issues.append({'source':p.name,'kind':'missing_anchor','target':target})
result={'scope':'Top-level docs plus the new capture diagnostic Markdown inline links and explicit full reference links; fenced code excluded. ATX heading approximation, explicit HTML id/name anchors; external targets counted but not fetched. Not a full CommonMark parser; shortcut references/setext headings/README outside link targets not independently audited.','documents':len(docs),'localTargets':count,'checkedAnchors':anchorcount,'externalTargetsNotFetched':external,'issues':issues}
pathlib.Path('/tmp/native99-local-doc-links.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='scope'}))
