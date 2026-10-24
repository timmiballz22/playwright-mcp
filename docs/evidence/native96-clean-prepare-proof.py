import tempfile,pathlib,subprocess,json,hashlib,shutil
root=pathlib.Path('/workspace/playwright-mcp');work=pathlib.Path(tempfile.mkdtemp(prefix='playwright-screenshot-build-',dir='/tmp'));log=pathlib.Path('/tmp/native96-clean-prepare.log');results=[]
def run(args,cwd=work):
 p=subprocess.run(args,cwd=cwd,stdout=f,stderr=subprocess.STDOUT,timeout=90);return p.returncode
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
with log.open('w') as f:
 assert run(['git','worktree','add','--detach',str(work),'HEAD'],root)==0
 try:
  assert run(['npm','ci','--ignore-scripts','--no-audit','--no-fund'])==0
  target=work/'node_modules/playwright-core/lib/coreBundle.js';original=sha(target);assert original=='829521b67ed7be90c7d6d6098ff39f2241562d47e4ad7ccab13710924a56001d'
  shutil.copy2(root/'scripts/prepare-vp9-metadata.cjs',work/'scripts/prepare-vp9-metadata.cjs')
  assert run(['node','scripts/prepare-vp9-metadata.cjs'])==0
  patched=sha(target);assert patched=='2e36b79ec8f27082edc4bb688abc800cfbc351d5c5c3c9a2320629939cc29686'
  before=target.stat();assert run(['node','scripts/prepare-vp9-metadata.cjs'])==0;after=target.stat();assert before.st_ino==after.st_ino and before.st_mtime_ns==after.st_mtime_ns and sha(target)==patched
  with target.open('ab') as t:t.write(b'\n// controlled negative integrity calibration\n')
  corrupted=sha(target);rejected=run(['node','scripts/prepare-vp9-metadata.cjs']);assert rejected!=0 and sha(target)==corrupted
  results={'originalHash':original,'patchedHash':patched,'originalMigrationPassed':True,'idempotentPreservesInodeMtime':True,'unknownSourceRejected':True,'unknownSourceNotRewritten':True,'actualCheckout':True,'installScriptsDisabledBeforePreparation':True}
 finally:
  run(['git','restore','scripts/prepare-vp9-metadata.cjs']);run(['git','worktree','remove',str(work)],root)
pathlib.Path('/tmp/native96-clean-prepare-proof.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results))
