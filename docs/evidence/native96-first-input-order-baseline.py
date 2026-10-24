from pathlib import Path
import subprocess,tempfile,json,hashlib,shutil
r=Path('/workspace/playwright-mcp');w=Path(tempfile.mkdtemp(prefix='playwright-viewport-input-baseline-',dir='/tmp'));log=Path('/tmp/native96-first-input-order-baseline.log');test='local-batch/chromium-viewport-order.test.mjs'
def run(args,cwd=w):return subprocess.run(args,cwd=cwd,stdout=f,stderr=subprocess.STDOUT,timeout=90).returncode
with log.open('w') as f:
 assert run(['git','worktree','add','--detach',str(w),'fdd83e0'],r)==0
 try:
  assert run(['npm','ci','--no-audit','--no-fund'])==0
  core=hashlib.sha256((w/'node_modules/playwright-core/lib/coreBundle.js').read_bytes()).hexdigest();assert core=='3eb68a089871529d6dccd723546bc87e20299047e140d382dc5fe380b1350192'
  assert not(w/test).exists();shutil.copy2(r/test,w/test);exit=run(['node','--test',test]);assert exit==1
 finally:
  (w/test).unlink(missing_ok=True);assert run(['git','worktree','remove',str(w)],r)==0
s=log.read_text();assert 'chromium_viewport_first_input' in s and '"height":153' in s
proof={'actualCheckout':'fdd83e0','preparedCore':core,'expectedBaselineTestExit':exit,'firstInputHeight':153,'testFailureIsActualFirstJpegGeometry':True,'scope':'Actual unmodified old prepared Playwright through page.setViewportSize. Trusted100ms delay before actual window command dispatch; same first-JPEG regression as fixed candidate. Controlled scheduling, not unforced native macOS creation-cause proof.','temporaryWorktreeRemoved':True};Path('/tmp/native96-first-input-order-baseline-proof.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
