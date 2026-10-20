import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
test('source distribution cannot publish as Microsoft and includes runtime SDK', async () => {
  const pkg = JSON.parse(await readFile(new URL('package.json', root)));
  assert.notEqual(pkg.name, '@playwright/mcp');
  assert.equal(pkg.private, true);
  assert.ok(pkg.dependencies['@modelcontextprotocol/sdk']);
  assert.ok(pkg.files.includes('local-batch/*.mjs'));
  const publish = await readFile(new URL('.github/workflows/publish.yml', root), 'utf8');
  assert.doesNotMatch(publish, /npm publish|mcp-publisher|id-token: write/);
});
