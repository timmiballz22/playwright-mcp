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

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

import { test as baseTest, expect as baseExpect } from '@playwright/test';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client as SDKClient } from '@modelcontextprotocol/sdk/client/index.js';
import type { CallToolResult, CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import type { windowsLegacyComparison } from '../local-batch/fixtures/windows-process-graph.mjs';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TestServer } from './testserver/index';
import { ownedScopeDescendants } from '../local-batch/fixtures/process-audit.mjs';
import { trackToolProgress } from '../local-batch/fixtures/tool-progress.mjs';
import { createStderrCapture } from './fixtures/bounded-stderr.mjs';

const originalToolNames = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/evidence/discovery-chromium-extended.json'), 'utf8')).tools.map((tool: { name: string }) => tool.name));

import type { Config } from '../config';
import type { BrowserContext } from 'playwright';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { Stream } from 'stream';

// The SDK validates its default result with CallToolResultSchema, but its
// declaration also includes the explicit compatibility-schema result. Preserve
// that overload while exposing the already validated default response type.
class Client extends SDKClient {
  override callTool(params: Parameters<SDKClient['callTool']>[0], resultSchema?: typeof CallToolResultSchema, options?: Parameters<SDKClient['callTool']>[2]): Promise<CallToolResult>;
  override callTool(...args: Parameters<SDKClient['callTool']>): ReturnType<SDKClient['callTool']>;
  override callTool(...args: Parameters<SDKClient['callTool']>): ReturnType<SDKClient['callTool']> {
    return super.callTool(...args);
  }
}

export type TestOptions = {
  mcpArgs: string[] | undefined;
  mcpBrowser: string | undefined;
  mcpMode: 'docker' | undefined;
};

type CDPServer = {
  endpoint: string;
  start: () => Promise<BrowserContext>;
};

export type StartClient = (options?: {
  clientName?: string,
  args?: string[],
  config?: Config,
  roots?: { name: string, uri: string }[],
  rootsResponseDelay?: number,
  extensionToken?: string,
  env?: Record<string, string>,
}) => Promise<{ client: Client, stderr: () => string, stderrInfo: () => { byteLimit: number, retainedBytes: number, overflow: boolean }, observeOwnedProcesses: () => Promise<{ observedCount: number, transportRootMatches: number }> }>;


type TestFixtures = {
  client: Client;
  startClient: StartClient;
  wsEndpoint: string;
  cdpServer: CDPServer;
  server: TestServer;
  httpsServer: TestServer;
  mcpHeadless: boolean;
};

type WorkerFixtures = {
  _workerServers: { server: TestServer, httpsServer: TestServer };
};

export const test = baseTest.extend<TestFixtures & TestOptions, WorkerFixtures>({

  mcpArgs: [undefined, { option: true }],

  client: async ({ startClient }, use) => {
    const { client } = await startClient();
    await use(client);
  },

  startClient: async ({ mcpHeadless, mcpBrowser, mcpMode, mcpArgs }, use, testInfo) => {
    const clients: Client[] = [];
    const progress: Array<() => unknown> = [];
    const stderrCaptures: Array<{ capture: ReturnType<typeof createStderrCapture>, ended: () => boolean }> = [];
    let processAuditSequence = 0;

    await use(async options => {
      const cwd = testInfo.outputPath();
      const args: string[] = [...(mcpArgs ?? [])];
      if (mcpHeadless)
        args.push('--headless');
      if (mcpBrowser)
        args.push(`--browser=${mcpBrowser}`);
      if (options?.args)
        args.push(...options.args);
      if (options?.config) {
        const configFile = testInfo.outputPath('config.json');
        await fs.promises.writeFile(configFile, JSON.stringify(options.config, null, 2));
        args.push(`--config=${path.relative(cwd, configFile)}`);
      }

      const client = new Client({ name: options?.clientName ?? 'test', version: '1.0.0' }, options?.roots ? { capabilities: { roots: {} } } : undefined);
      progress.push(trackToolProgress(client, originalToolNames));
      if (options?.roots) {
        client.setRequestHandler(ListRootsRequestSchema, async request => {
          if (options.rootsResponseDelay)
            await new Promise(resolve => setTimeout(resolve, options.rootsResponseDelay));
          return {
            roots: options.roots,
          };
        });
      }
      const { transport, stderr } = await createTransport(args, cwd, mcpMode, testInfo.outputPath('ms-playwright'), options?.env ?? {});
      const stderrCapture = createStderrCapture(); let stderrEnded = !stderr;
      stderrCaptures.push({ capture: stderrCapture, ended: () => stderrEnded });
      stderr?.once('end', () => { stderrEnded = true; });
      stderr?.on('data', data => {
        if (process.env.PWMCP_DEBUG)
          process.stderr.write(data);
        stderrCapture.observe(data);
      });
      clients.push(client);
      await client.connect(transport);
      await client.ping();
      let scope: { roots: Set<number>, liveRoots: Set<number>, identities: Map<number, string> } | undefined;
      const observeOwnedProcesses = async () => {
        if (mcpMode === 'docker' || !(transport instanceof StdioClientTransport)) throw new Error('source_observation_unavailable');
        const pid = transport.pid;
        if (!Number.isSafeInteger(pid) || !pid || pid <= 1) throw new Error('source_observation_unavailable');
        scope ??= { roots: new Set([pid]), liveRoots: new Set([pid]), identities: new Map() };
        if (!scope.liveRoots.has(pid)) throw new Error('source_transport_changed');
        let legacy: ReturnType<typeof windowsLegacyComparison> | undefined;
        const observed = await ownedScopeDescendants([scope], { rememberLiveRoots: true,
          compareLegacyRoots: [...scope.roots], onLegacyObservation: (value: ReturnType<typeof windowsLegacyComparison>) => { legacy = value; },
        });
        if (transport.pid !== pid) throw new Error('source_transport_changed');
        if (process.platform === 'win32') baseExpect(legacy).toBeTruthy();
        const record = JSON.stringify({ fixture: 'original_mcp_lifetime_comparison', observed,
          legacy, roots: [...scope.roots], identities: [...scope.identities] });
        baseExpect(Buffer.byteLength(record)).toBeLessThanOrEqual(65536);
        await fs.promises.writeFile(testInfo.outputPath(`source-process-audit-${++processAuditSequence}.json`), record, { flag: 'wx', mode: 0o600 });
        if (legacy?.legacyOnly.length) console.log(record);
        // Read-only diagnostic: all observed identities stay in this lifetime's
        // scope. No name/role filter, PID signalling or cleanup authorization.
        return { observedCount: observed.length, transportRootMatches: observed.includes(pid) ? 1 : 0 };
      };
      return { client, stderr: () => stderrCapture.text(), stderrInfo: () => stderrCapture.snapshot(), observeOwnedProcesses };
    });

    try {
      if (testInfo.status !== testInfo.expectedStatus) {
        const receipt = JSON.stringify({ fixture: 'original_mcp_progress', clientCount: progress.length, clients: progress.slice(0, 4).map(snapshot => snapshot()) });
        console.log(receipt);
        if (process.env.GITHUB_ACTIONS === 'true') console.error('::notice title=Original MCP progress::' + receipt);
      }
    } finally {
      const closed = await Promise.allSettled(clients.map(client => client.close()));
      const failures = closed.filter(result => result.status === 'rejected').map(result => result.reason);
      for (const { capture, ended } of stderrCaptures) {
        try { capture.assertWithinLimit(); } catch (error) { failures.push(error); }
        // SDK close can return after its final kill request, before pipe EOF.
        // Do not accept an unchecked tail or add another cleanup wait budget.
        if (!ended()) failures.push(new Error('fixture_stderr_close_unconfirmed'));
      }
      if (failures.length) throw new AggregateError(failures, 'Original MCP fixture teardown failed');
    }
  },

  wsEndpoint: async ({ }, use) => {
    const browserServer = await chromium.launchServer();
    await use(browserServer.wsEndpoint());
    await browserServer.close();
  },

  cdpServer: async ({ mcpBrowser }, use, testInfo) => {
    test.skip(!['chrome', 'msedge', 'chromium'].includes(mcpBrowser!), 'CDP is not supported for non-Chromium browsers');

    let browserContext: BrowserContext | undefined;
    const port = 3200 + test.info().parallelIndex;
    await use({
      endpoint: `http://localhost:${port}`,
      start: async () => {
        if (browserContext)
          throw new Error('CDP server already exists');
        browserContext = await chromium.launchPersistentContext(testInfo.outputPath('cdp-user-data-dir'), {
          channel: mcpBrowser,
          headless: true,
          args: [
            `--remote-debugging-port=${port}`,
          ],
        });
        return browserContext;
      }
    });
    await browserContext?.close();
  },

  mcpHeadless: async ({ headless }, use) => {
    await use(headless);
  },

  mcpBrowser: ['chrome', { option: true }],

  mcpMode: [undefined, { option: true }],

  _workerServers: [async ({ }, use, workerInfo) => {
    const port = 8907 + workerInfo.workerIndex * 4;
    const server = await TestServer.create(port);

    const httpsPort = port + 1;
    const httpsServer = await TestServer.createHTTPS(httpsPort);

    await use({ server, httpsServer });

    await Promise.all([
      server.stop(),
      httpsServer.stop(),
    ]);
  }, { scope: 'worker' }],

  server: async ({ _workerServers }, use) => {
    _workerServers.server.reset();
    await use(_workerServers.server);
  },

  httpsServer: async ({ _workerServers }, use) => {
    _workerServers.httpsServer.reset();
    await use(_workerServers.httpsServer);
  },
});

async function createTransport(args: string[], cwd: string, mcpMode: TestOptions['mcpMode'], profilesDir: string, env: Record<string, string>): Promise<{
  transport: Transport,
  stderr: Stream | null,
}> {
  if (mcpMode === 'docker') {
    const relCwd = path.relative(test.info().project.outputDir, cwd);
    const dockerCwd = path.posix.join('/app/test-results', relCwd.split(path.sep).join('/'));
    // An arbitrary mapped UID may have no writable home in the image. Give
    // Chromium/Crashpad private platform config/cache roots in the owned mount.
    fs.mkdirSync(path.join(cwd, '.config'), { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.join(cwd, '.cache'), { recursive: true, mode: 0o700 });
    const dockerArgs = ['run', '--rm', '-i', '--network=host', '-v', `${test.info().project.outputDir}:/app/test-results`, '-w', dockerCwd,
      '-e', `PWMCP_PROFILES_DIR_FOR_TEST=${path.posix.join(dockerCwd, 'ms-playwright')}`,
      '-e', `XDG_CONFIG_HOME=${path.posix.join(dockerCwd, '.config')}`,
      '-e', `XDG_CACHE_HOME=${path.posix.join(dockerCwd, '.cache')}`];
    // Bind-mounted private files must belong to the client reading them. Keep
    // CLI 0077 privacy; never make credential/snapshot artifacts world-readable.
    if (typeof process.getuid === 'function' && typeof process.getgid === 'function')
      dockerArgs.push('--user', `${process.getuid()}:${process.getgid()}`);
    const transport = new StdioClientTransport({
      command: 'docker',
      args: [...dockerArgs, 'playwright-mcp-dev:latest', ...args],
    });
    return {
      transport,
      stderr: transport.stderr,
    };
  }

  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, '../cli.js'), ...args],
    cwd,
    stderr: 'pipe',
    env: {
      ...process.env,
      DEBUG: process.env.PWMCP_DEBUG ? 'pw:mcp*' : 'pw:mcp:test',
      DEBUG_COLORS: '0',
      DEBUG_HIDE_DATE: '1',
      PWMCP_PROFILES_DIR_FOR_TEST: profilesDir,
      ...env,
    },
  });
  return {
    transport,
    stderr: transport.stderr!,
  };
}

type Response = Awaited<ReturnType<Client['callTool']>>;

export const expect = baseExpect.extend({
  toHaveResponse(response: Response, object: any) {
    const parsed = parseResponse(response, test.info().outputPath());
    const isNot = this.isNot;
    try {
      if (isNot)
        expect(parsed).not.toEqual(expect.objectContaining(object));
      else
        expect(parsed).toEqual(expect.objectContaining(object));
    } catch (e: any) {
      return {
        pass: isNot,
        message: () => e.message,
      };
    }
    return {
      pass: !isNot,
      message: () => ``,
    };
  },
});

export function formatOutput(output: string): string[] {
  return output.split('\n').map(line => line.replace(/^pw:mcp:test /, '').replace(/user data dir.*/, 'user data dir').trim()).filter(Boolean);
}

function parseResponse(response: any, cwd: string) {
  const text = response.content[0].text;
  const sections = parseSections(text);

  const error = sections.get('Error');
  const result = sections.get('Result');
  const code = sections.get('Ran Playwright code');
  const tabs = sections.get('Open tabs');
  const pageState = sections.get('Page state');
  const snapshotSection = sections.get('Snapshot');
  const consoleMessages = sections.get('New console messages');
  const modalState = sections.get('Modal state');
  const downloads = sections.get('Downloads');
  const codeNoFrame = code?.replace(/^```js\n/, '').replace(/\n```$/, '');
  const isError = response.isError;
  const attachments = response.content.slice(1);

  let snapshot: string | undefined;
  if (snapshotSection) {
    const match = snapshotSection.match(/\[Snapshot\]\(([^)]+)\)/);
    if (match) {
      try {
        snapshot = fs.readFileSync(path.resolve(cwd, match[1]), 'utf-8');
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        throw new Error(`Snapshot link could not be read (${['EACCES', 'ENOENT', 'EPERM'].includes(code ?? '') ? code : 'read_failed'}).`);
      }
    } else {
      snapshot = snapshotSection.replace(/^```yaml\n?/, '').replace(/\n?```$/, '');
    }
  }

  return {
    error,
    result,
    code: codeNoFrame,
    tabs,
    pageState,
    snapshot,
    consoleMessages,
    modalState,
    downloads,
    isError,
    attachments,
  };
}

function parseSections(text: string): Map<string, string> {
  const sections = new Map<string, string>();
  const sectionHeaders = text.split(/^### /m).slice(1); // Remove empty first element

  for (const section of sectionHeaders) {
    const firstNewlineIndex = section.indexOf('\n');
    if (firstNewlineIndex === -1)
      continue;

    const sectionName = section.substring(0, firstNewlineIndex);
    const sectionContent = section.substring(firstNewlineIndex + 1).trim();
    sections.set(sectionName, sectionContent);
  }

  return sections;
}
