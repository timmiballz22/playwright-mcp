// Verify the locally built image; never pull an image or start a browser here.
const { spawnSync } = require('node:child_process');
const { patchedHash } = require('./prepare-vp9-metadata.cjs');
const program = `const fs=require('node:fs'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const r=createRequire('/app/cli.js');const file=r.resolve('playwright-core/lib/coreBundle');
const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if(hash!==${JSON.stringify(patchedHash)})process.exit(1);
process.stdout.write(JSON.stringify({component:'docker_vp9_metadata_patch',sha256:hash})+'\\n');`;
const result = spawnSync('docker', ['run', '--rm', '--pull=never', '--entrypoint', 'node', 'playwright-mcp-dev:latest', '-e', program], {
  encoding: 'utf8', timeout: 30000, maxBuffer: 4096, windowsHide: true,
});
if (result.status !== 0 || result.error) {
  process.stderr.write('Docker encoder metadata verification failed.\n'); process.exitCode = 1;
} else {
  let value;
  try { value = JSON.parse(result.stdout); } catch {}
  if (value?.component !== 'docker_vp9_metadata_patch' || value.sha256 !== patchedHash) {
    process.stderr.write('Docker encoder metadata verification failed.\n'); process.exitCode = 1;
  } else process.stdout.write(JSON.stringify(value) + '\n');
}
