// Actual execution host for the abrupt-parent-death regression; no model turns.
import { executeWorkflow } from '../executor.mjs';
const summary = await executeWorkflow({ timeoutMs: 30000, steps: [{ type: 'goto', url: process.argv[2] }] }, {
  allowedOrigins: [new URL(process.argv[2]).origin], artifactsDir: process.argv[3],
  onEvent: event => { if (event.pid) process.stdout.write(JSON.stringify(event) + '\n'); },
});
process.stdout.write(JSON.stringify({ type: 'done', ok: summary.ok }) + '\n');
