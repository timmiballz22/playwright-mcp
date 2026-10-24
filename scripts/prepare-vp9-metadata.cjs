// Deterministic private build patch: VP9 color metadata and one bounded retry
// of Chromium's specific read-only screenshot-unavailable protocol failure,
// plus ordered window-bounds/device-metrics viewport setup.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const originalHash = '829521b67ed7be90c7d6d6098ff39f2241562d47e4ad7ccab13710924a56001d';
const previousHash = '3eb68a089871529d6dccd723546bc87e20299047e140d382dc5fe380b1350192';
const screenshotHash = '2e36b79ec8f27082edc4bb688abc800cfbc351d5c5c3c9a2320629939cc29686';
const patchedHash = '9f9750ae24604e2099e1c1f6564d5d6cb3d19d30dfbc8b5ec61ba18c0989e25a';
const fail = code => { throw Object.assign(new Error(code), { safeCode: code }); };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
module.exports = Object.freeze({ version: '1.64.1', originalHash, previousHash, screenshotHash, patchedHash });
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
  if (current !== originalHash && current !== previousHash && current !== screenshotHash && current !== patchedHash) fail('upstream_patch_source');
  let changed = false;
  if (current !== patchedHash) {
    const needle = '          "-c:v libvpx-vp9",';
    let text = source.toString('utf8');
    if (current === originalHash) {
      if (text.split(needle).length !== 2) fail('upstream_patch_source');
      text = text.replace(needle, needle + '\n          "-colorspace smpte170m",\n          "-color_primaries bt709",');
    }
    const captureNeedle = current === screenshotHash ? `        const capture = () => progress2.race(this._mainFrameSession._client.send("Page.captureScreenshot", { format: format2, quality, clip, captureBeyondViewport: !fitsViewport }));
        let result2;
        try {
          result2 = await capture();
        } catch (error) {
          // One read-only retry, under the same original progress deadline.
          if (!isProtocolError(error) || error.method !== "Page.captureScreenshot" || error.message !== "Protocol error (Page.captureScreenshot): Unable to capture screenshot")
            throw error;
          progress2.log("retrying Chromium screenshot after capture unavailable");
          result2 = await capture();
        }` : '        const result2 = await progress2.race(this._mainFrameSession._client.send("Page.captureScreenshot", { format: format2, quality, clip, captureBeyondViewport: !fitsViewport }));';
    const captureReplacement = `        const capture = () => progress2.race(this._mainFrameSession._client.send("Page.captureScreenshot", { format: format2, quality, clip, captureBeyondViewport: !fitsViewport }));
        let result2;
        try {
          result2 = await capture();
        } catch (error) {
          // One read-only retry, under the same original progress deadline.
          if (!isProtocolError(error) || error.method !== "Page.captureScreenshot" || error.message !== "Protocol error (Page.captureScreenshot): Unable to capture screenshot")
            throw error;
          progress2.signal.throwIfAborted();
          progress2.log("retrying Chromium screenshot after capture unavailable");
          result2 = await capture();
        }`;
    if (text.split(captureNeedle).length !== 2) fail('upstream_patch_source');
    text = text.replace(captureNeedle, captureReplacement);
    const windowNeedle = `          promises2.push(this.setWindowBounds({
            width: viewportSize.width + insets.width,
            height: viewportSize.height + insets.height
          }));`;
    const windowReplacement = `          // Apply device metrics after window resizing has completed.
          await this.setWindowBounds({
            width: viewportSize.width + insets.width,
            height: viewportSize.height + insets.height
          });`;
    if (text.split(windowNeedle).length !== 2) fail('upstream_patch_source');
    const output = Buffer.from(text.replace(windowNeedle, windowReplacement));
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
