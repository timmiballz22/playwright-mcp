#!/usr/bin/env node
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// The standalone process owns its creation mask. Fresh exported browser state
// can contain credentials; never inherit group/world-readable file defaults.
// Library hosts retain control of their own process mask. Existing files and
// Windows ACLs require separate protection; umask does not repair either.
if (process.platform !== 'win32') process.umask(0o077);

// Standalone diagnosis runs before backend loading and never opens a browser.
if (process.argv[2] === 'profile-doctor') {
  const args = process.argv.slice(3);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write('Usage: playwright-mcp profile-doctor <profile-directory>\nRead guard metadata only; no credentials, reset or process termination.\n');
  } else if (args.length !== 1 || !args[0] || args[0].startsWith('-')) {
    process.stdout.write(JSON.stringify({ ok: false, code: 'invalid_arguments' }) + '\n'); process.exitCode = 2;
  } else {
    void require('./local-batch/profile-lease.cjs').inspectProfileLease(args[0]).then(result => {
      process.stdout.write(JSON.stringify(result) + '\n'); if (!result.ok) process.exitCode = 1;
    }).catch(() => { process.stdout.write(JSON.stringify({ ok: false, code: 'profile_unavailable' }) + '\n'); process.exitCode = 1; });
  }
  return;
}

const { program } = require('playwright-core/lib/utilsBundle');
const { tools, libCli } = require('playwright-core/lib/coreBundle');
// Compose persistent-profile ownership over public APIs; tools stay delegated.
require('./local-batch/profile-guard.cjs').installProfileGuard(require('playwright-core'));

if (process.argv.includes('install-browser')) {
  const argv = process.argv.map(arg => arg === 'install-browser' ? 'install' : arg);
  libCli.decorateProgram(program);
  void program.parseAsync(argv);
  return;
}

const packageJSON = require('./package.json');
const p = program.version('Version ' + packageJSON.version).name('Playwright MCP');
tools.decorateMCPCommand(p, packageJSON.version);
p.addHelpText('after', '\nRead-only profile diagnosis: playwright-mcp profile-doctor <profile-directory>\n');

void program.parseAsync(process.argv);
