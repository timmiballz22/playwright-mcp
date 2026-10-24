import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm, symlink, link, rename } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

async function fixture(body) {
  const base = await mkdtemp(path.join(os.tmpdir(), 'dependency-patch-'));
  const root = path.join(base, 'source');
  const core = path.join(root, 'node_modules', 'playwright-core');
  const script = path.join(root, 'scripts', 'prepare-vp9-metadata.cjs');
  const bytes = Buffer.from('private-patch-fixture-canary');
  try {
    await mkdir(path.dirname(script), { recursive: true }); await mkdir(path.join(core, 'lib'), { recursive: true });
    await copyFile(new URL('../scripts/prepare-vp9-metadata.cjs', import.meta.url), script);
    await writeFile(path.join(core, 'package.json'), JSON.stringify({ name: 'playwright-core', version: '1.64.1' }));
    await writeFile(path.join(core, 'lib/coreBundle.js'), bytes);
    const run = (args = []) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 5000 });
    const rejected = (result, code) => {
      assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.equal(result.stderr.trim(), code);
      assert.equal(result.stderr.includes('private-patch-fixture-canary'), false);
    };
    await body({ base, root, core, script, bytes, run, rejected });
  } finally { await rm(base, { recursive: true, force: true }); }
}

test('build patch refuses extra caller arguments before touching dependencies', async () => {
  await fixture(async ({ core, bytes, run, rejected }) => {
    rejected(run(['private-patch-fixture-canary']), 'upstream_patch_arguments');
    assert.deepEqual(await readFile(path.join(core, 'lib/coreBundle.js')), bytes);
  });
});
test('build patch refuses an unreviewed dependency version without mutation', async () => {
  await fixture(async ({ core, bytes, run, rejected }) => {
    await writeFile(path.join(core, 'package.json'), JSON.stringify({ name: 'playwright-core', version: '1.64.2' }));
    rejected(run(), 'upstream_patch_version'); assert.deepEqual(await readFile(path.join(core, 'lib/coreBundle.js')), bytes);
  });
});
test('build patch refuses unknown source bytes and keeps JSON stdout clean', async () => {
  await fixture(async ({ core, bytes, run, rejected }) => {
    rejected(run(), 'upstream_patch_source'); assert.deepEqual(await readFile(path.join(core, 'lib/coreBundle.js')), bytes);
  });
});
test('build patch refuses dependency junctions outside its own node_modules', async () => {
  await fixture(async ({ base, root, core, bytes, run, rejected }) => {
    const external = path.join(base, 'external-core');
    await mkdir(path.join(external, 'lib'), { recursive: true });
    await writeFile(path.join(external, 'lib/coreBundle.js'), bytes);
    await rm(core, { recursive: true }); await symlink(external, path.join(root, 'node_modules/playwright-core'), 'junction');
    rejected(run(), 'upstream_patch_dependency_scope'); assert.deepEqual(await readFile(path.join(external, 'lib/coreBundle.js')), bytes);
  });
});
test('build patch refuses multiply linked source files', async () => {
  await fixture(async ({ base, core, bytes, run, rejected }) => {
    const file = path.join(core, 'lib/coreBundle.js'); const alias = path.join(base, 'alias'); await link(file, alias);
    rejected(run(), 'upstream_patch_dependency_scope');
    assert.deepEqual(await readFile(file), bytes); assert.deepEqual(await readFile(alias), bytes);
  });
});

test('build patch refuses a linked node_modules shared with another source tree', async () => {
  await fixture(async ({ base, root, bytes, run, rejected }) => {
    const modules = path.join(root, 'node_modules'); const external = path.join(base, 'shared-modules');
    await rename(modules, external); await symlink(external, modules, 'junction');
    rejected(run(), 'upstream_patch_dependency_scope');
    assert.deepEqual(await readFile(path.join(external, 'playwright-core/lib/coreBundle.js')), bytes);
  });
});
test('build patch preserves incomplete private output and refuses to package it', async () => {
  await fixture(async ({ core, bytes, run, rejected }) => {
    const temporary = path.join(core, 'lib/coreBundle.js.private-patch-fixture'); await writeFile(temporary, bytes);
    rejected(run(), 'upstream_patch_incomplete');
    assert.deepEqual(await readFile(temporary), bytes); assert.deepEqual(await readFile(path.join(core, 'lib/coreBundle.js')), bytes);
  });
});

test('build patch refuses a dependency link to another directory inside node_modules', async () => {
  await fixture(async ({ root, core, bytes, run, rejected }) => {
    const sibling = path.join(root, 'node_modules', 'another-core'); await rename(core, sibling);
    await symlink(sibling, core, 'junction'); rejected(run(), 'upstream_patch_dependency_scope');
    assert.deepEqual(await readFile(path.join(sibling, 'lib/coreBundle.js')), bytes);
  });
});
