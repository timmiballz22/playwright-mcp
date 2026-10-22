// Deterministic build-time patch for the private distribution, not a runtime hook.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const originalHash = '829521b67ed7be90c7d6d6098ff39f2241562d47e4ad7ccab13710924a56001d';
const patchedHash = 'b46a37ecb04912c639ffd32f890269ea33a612dfdcb43f518bac76b85cc0fa9f';
const fail = code => { throw Object.assign(new Error(code), { safeCode: code }); };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
module.exports = Object.freeze({ version: '1.64.1', originalHash, patchedHash });
function prepare() {
try {
  if (process.argv.length !== 2) fail('upstream_patch_arguments');
  const root = path.resolve(__dirname, '..');
  const sourceRoot = fs.realpathSync(root);
  const modules = fs.realpathSync(path.join(sourceRoot, 'node_modules'));
  if (modules !== path.join(sourceRoot, 'node_modules')) fail('upstream_patch_dependency_scope');
  const corePath = path.join(modules, 'playwright-core');
  const coreEntry = fs.lstatSync(corePath);
  if (!coreEntry.isDirectory() || coreEntry.isSymbolicLink()) fail('upstream_patch_dependency_scope');
  const core = fs.realpathSync(corePath);
  if (path.dirname(core) !== modules) fail('upstream_patch_dependency_scope');
  const manifest = JSON.parse(fs.readFileSync(path.join(core, 'package.json'), 'utf8'));
  if (manifest.name !== 'playwright-core' || manifest.version !== '1.64.1') fail('upstream_patch_version');
  const file = path.join(core, 'lib', 'coreBundle.js');
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || fs.realpathSync(file) !== file) fail('upstream_patch_dependency_scope');
  if (fs.readdirSync(path.dirname(file)).some(name => name.startsWith('coreBundle.js.private-patch-'))) fail('upstream_patch_incomplete');
  const source = fs.readFileSync(file);
  const current = hash(source);
  if (current !== originalHash && current !== patchedHash) fail('upstream_patch_source');
  let changed = false;
  if (current === originalHash) {
    const needle = '          "-c:v libvpx-vp9",';
    const text = source.toString('utf8');
    if (text.split(needle).length !== 2) fail('upstream_patch_source');
    const output = Buffer.from(text.replace(needle, needle + '\n          "-colorspace smpte170m",'));
    if (hash(output) !== patchedHash) fail('upstream_patch_output');
    const temporary = file + '.private-patch-' + crypto.randomUUID();
    try {
      fs.writeFileSync(temporary, output, { flag: 'wx', mode: stat.mode & 0o777 });
      fs.renameSync(temporary, file);
    } finally {
      try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    changed = true;
  }
  process.stderr.write(JSON.stringify({ component: 'private_vp9_metadata_patch', version: manifest.version, changed, sha256: patchedHash }) + '\n');
} catch (error) {
  const known = new Set(['upstream_patch_arguments','upstream_patch_dependency_scope','upstream_patch_version','upstream_patch_source','upstream_patch_output','upstream_patch_incomplete']);
  process.stderr.write((known.has(error.safeCode) ? error.safeCode : 'upstream_patch_unavailable') + '\n');
  process.exitCode = 1;
}
}
if (require.main === module) prepare();
