from pathlib import Path
import tempfile,subprocess,hashlib,json,shutil
r=Path('/workspace/playwright-mcp');w=Path(tempfile.mkdtemp(prefix='playwright-metadata-migration-',dir='/tmp'));log=Path('/tmp/native96-metadata-migration.log')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(args,cwd=w):return subprocess.run(args,cwd=cwd,stdout=f,stderr=subprocess.STDOUT,timeout=90).returncode
with log.open('w') as f:
 assert run(['git','worktree','add','--detach',str(w),'fdd83e0'],r)==0
 try:
  assert run(['npm','ci','--no-audit','--no-fund'])==0
  core=w/'node_modules/playwright-core/lib/coreBundle.js';before=sha(core);assert before=='3eb68a089871529d6dccd723546bc87e20299047e140d382dc5fe380b1350192'
  shutil.copy2(r/'scripts/prepare-vp9-metadata.cjs',w/'scripts/prepare-vp9-metadata.cjs');assert run(['node','scripts/prepare-vp9-metadata.cjs'])==0;after=sha(core);assert after=='9f9750ae24604e2099e1c1f6564d5d6cb3d19d30dfbc8b5ec61ba18c0989e25a'
 finally:run(['git','restore','scripts/prepare-vp9-metadata.cjs']);assert run(['git','worktree','remove',str(w)],r)==0
proof={'actualCheckoutRef':'fdd83e0','originalNpmCiPrepareExecuted':True,'fromHash':before,'toHash':after,'migrationPassed':True,'temporaryWorktreeRemoved':True};Path('/tmp/native96-metadata-migration-proof.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
