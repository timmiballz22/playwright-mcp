#!/usr/bin/env node
import { guardianDiagnosticLine } from './jobs/guardian-diagnostic.mjs';
// Optional preview stdio endpoint. No daemon, HTTP listener or untrusted code.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { setTimeout as delay } from 'node:timers/promises';
import { JobController } from './jobs/controller.mjs';
import { supportsJournal } from './jobs/journal.mjs';
import { resolveJobConfig } from './jobs/config.mjs';
import { workflowInputSchema } from './workflow-contract.mjs';
const terminal = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT', 'CRASHED']);
const idSchema = { type: 'string', pattern: '^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$' };
const schema = (properties, required) => ({ type: 'object', additionalProperties: false, properties, required });
const definitions = [
  { name: 'start_workflow', description: 'Start a bounded local job. Reuse requestKey with the same workflow to avoid duplicate execution. Closing this MCP process cancels its work; no daemon is installed.', inputSchema: schema({ workflow: workflowInputSchema, requestKey: { type: 'string', minLength: 1, maxLength: 128 } }, ['workflow', 'requestKey']) },
  { name: 'get_workflow_status', description: 'Read authorized job state, confirmed progress and safe milestones.', inputSchema: schema({ jobId: idSchema }, ['jobId']) },
  { name: 'get_workflow_result', description: 'Read bounded job result. Optional waitMs waits at most ten seconds. No replay or automatic resume.', inputSchema: schema({ jobId: idSchema, waitMs: { type: 'integer', minimum: 0, maximum: 10000 } }, ['jobId']) },
  { name: 'cancel_workflow', description: 'Persist cancellation intent for an authorized job. Terminal cancellation follows owned cleanup; repeated calls are safe.', inputSchema: schema({ jobId: idSchema }, ['jobId']) },
  { name: 'cleanup_workflows', description: 'Preview or remove artifacts of up to ten authorized terminal jobs with confirmed cleanup. Dry run defaults true. Durable request keys and result summaries are retained. Per-job outcomes allow partial completion.', inputSchema: schema({ jobIds: { type: 'array', minItems: 1, maxItems: 10, uniqueItems: true, items: idSchema }, dryRun: { type: 'boolean', default: true } }, ['jobIds']) },
  { name: 'list_workflows', description: 'List at most twenty recent jobs for the configured local owner/project.', inputSchema: schema({ limit: { type: 'integer', minimum: 1, maximum: 20 } }, []) },
];
const codes = new Set(['not_found', 'queue_full', 'history_full', 'idempotency_conflict', 'controller_busy', 'cleanup_blocked', 'journal_busy', 'journal_unavailable', 'storage_full', 'controller_closed', 'request_cancelled', 'not_terminal', 'unsafe_artifacts', 'cleanup_limit']);
const response = (value, isError = false) => ({ isError, content: [{ type: 'text', text: JSON.stringify(value) }] });
const dto = job => ({ ...job, progressPercent: job.total ? Math.floor(job.completed / job.total * 100) : 0 });
function argumentsOf(name, value) {
  const definition = definitions.find(tool => tool.name === name);
  if (!definition) throw Object.assign(new Error(), { code: 'unknown_tool' });
  const args = value ?? {};
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(key => !Object.hasOwn(definition.inputSchema.properties, key)) || definition.inputSchema.required.some(key => !Object.hasOwn(args, key))) throw new TypeError('invalid_arguments');
  if (name === 'start_workflow' && (typeof args.requestKey !== 'string' || !args.requestKey.length || args.requestKey.length > 128)) throw new TypeError('invalid_arguments');
  if (name === 'cleanup_workflows' && (!Array.isArray(args.jobIds) || !args.jobIds.length || args.jobIds.length > 10 || new Set(args.jobIds).size !== args.jobIds.length || args.jobIds.some(id => typeof id !== 'string' || !new RegExp(idSchema.pattern).test(id)) || args.dryRun !== undefined && typeof args.dryRun !== 'boolean')) throw new TypeError('invalid_arguments');
  if (name !== 'start_workflow' && name !== 'list_workflows' && name !== 'cleanup_workflows' && (typeof args.jobId !== 'string' || !new RegExp(idSchema.pattern).test(args.jobId))) throw Object.assign(new Error(), { code: 'not_found' });
  if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 20) || args.waitMs !== undefined && (!Number.isInteger(args.waitMs) || args.waitMs < 0 || args.waitMs > 10000)) throw new TypeError('invalid_arguments');
  return args;
}
async function main() {
  if (!supportsJournal) throw Object.assign(new Error(), { code: 'unsupported_runtime' });
  const config = await resolveJobConfig();
  const server = new Server({ name: 'local-playwright-jobs-preview', version: '0.1.0' }, { capabilities: { tools: {} } });
  const controller = await JobController.open({ ...config, onEvent: event => {
    if (event.type === 'guardianFailed') process.stderr.write(guardianDiagnosticLine(event.diagnostic));
    if (event.type === 'guardianExited') process.stderr.write(`Local job guardian exited (${event.code ?? 'unknown'}/${event.signal}).\n`);
  } });
  let closing;
  const shutdown = () => {
    if (!closing) closing = (async () => {
      const result = await controller.close();
      await server.close();
      if (!result.cleanupConfirmed) process.exitCode = 1;
    })().catch(() => { process.exitCode = 1; });
    return closing;
  };
  server.onclose = () => { process.stdin.destroy(); void shutdown(); };
  process.stdin.once('end', () => { void shutdown(); });
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: definitions }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    try {
      if (closing || extra.signal.aborted) throw Object.assign(new Error(), { code: 'request_cancelled' });
      const name = request.params.name; const args = argumentsOf(name, request.params.arguments);
      if (name === 'start_workflow') {
        const job = await controller.start(args.workflow, args.requestKey);
        if (extra.signal.aborted) await controller.cancel(job.jobId);
        return response(dto(await controller.status(job.jobId)));
      }
      if (name === 'cleanup_workflows') {
        const results = [];
        for (const jobId of args.jobIds) {
          if (extra.signal.aborted) break;
          try { results.push({ jobId, ok: true, ...await controller.cleanup(jobId, args.dryRun ?? true) }); }
          catch (error) { results.push({ jobId, ok: false, code: codes.has(error?.code) ? error.code : 'cleanup_failed' }); }
        }
        return response({ results, interrupted: extra.signal.aborted });
      }
      if (name === 'get_workflow_status') return response(dto(await controller.status(args.jobId)));
      if (name === 'cancel_workflow') return response(dto(await controller.cancel(args.jobId)));
      if (name === 'list_workflows') return response({ jobs: (await controller.list(args.limit ?? 20)).map(dto) });
      const end = performance.now() + (args.waitMs ?? 0);
      let job;
      do {
        job = await controller.status(args.jobId);
        if (terminal.has(job.state) || performance.now() >= end) break;
        await delay(Math.min(250, Math.max(1, end - performance.now())), undefined, { signal: extra.signal });
      } while (true);
      return response({ job: dto(job), ready: terminal.has(job.state), result: job.resultAvailable ? await controller.result(args.jobId) : null });
    } catch (error) {
      const code = error?.name === 'AbortError' ? 'request_cancelled' : error?.code === 'unknown_tool' ? 'unknown_tool' : codes.has(error?.code) ? error.code : 'invalid_workflow_or_arguments';
      return response({ code, retrySafe: false }, true);
    }
  });
  try { await server.connect(new StdioServerTransport()); }
  catch { await shutdown(); throw Object.assign(new Error(), { code: 'transport_unavailable' }); }
}
main().catch(error => {
  const code = /^[a-z_]{1,40}$/.test(error?.code ?? '') ? error.code : 'jobs_unavailable';
  process.stderr.write('Local jobs startup failed (' + code + '). Check trusted owner, private storage and runtime configuration.\n');
  process.exitCode = 1;
});
