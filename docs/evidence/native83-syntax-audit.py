from pathlib import Path
import subprocess,json,concurrent.futures,sys
node=sys.argv[1];dest=Path(sys.argv[2]);root=Path.cwd()
files=[p for p in subprocess.check_output(['git','ls-files'],text=True).splitlines() if Path(p).suffix in ['.js','.mjs','.cjs'] and not p.startswith('docs/evidence/')]
def check(name):
 p=subprocess.run([node,'--check',str(root/name)],capture_output=True,text=True)
 return {'file':name,'exit':p.returncode,'diagnostic':p.stderr if p.returncode else ''}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as e:rows=list(e.map(check,files))
r={'head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'node':subprocess.check_output([node,'--version'],text=True).strip(),'command':'node --check <each tracked .js/.mjs/.cjs outside docs/evidence>','checkedFiles':len(rows),'failedFiles':sum(x['exit']!=0 for x in rows),'files':rows,'scope':'Syntax only; no module import, runtime execution or JS type checking. Browser code in HTML/string fixtures is outside this check.'}
dest.write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps({k:r[k] for k in ['head','node','checkedFiles','failedFiles']}))
raise SystemExit(bool(r['failedFiles']))
