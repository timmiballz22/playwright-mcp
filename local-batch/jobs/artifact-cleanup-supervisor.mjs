import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const failure = code => Object.assign(new Error(code), { code });
const worker = fileURLToPath(new URL('./artifact-cleanup-worker.mjs', import.meta.url));
const codes = new Set(['invalid_metadata', 'unsafe_artifacts', 'cleanup_limit', 'cleanup_failed']);
function validResult(result, dryRun) {
  return result && typeof result === 'object' && !Array.isArray(result) &&
    Object.keys(result).sort().join(',') === 'alreadyAbsent,bytes,dryRun,files,removed' &&
    result.dryRun === dryRun && Number.isSafeInteger(result.files) && result.files >= 0 && result.files <= 2048 &&
    Number.isSafeInteger(result.bytes) && result.bytes >= 0 && result.bytes <= 536870912 &&
    typeof result.removed === 'boolean' && typeof result.alreadyAbsent === 'boolean' &&
    result.removed === (!dryRun && !result.alreadyAbsent) &&
    (!result.alreadyAbsent || result.files === 0 && result.bytes === 0);
}
// Hooks are trusted source-only fault injection, never public MCP/CLI inputs.
export function cleanupJobArtifactsBounded(options, { workerModule = worker, timeoutMs = 5000, killGraceMs = 1000, onEvent } = {}) {
  return new Promise((resolve, reject) => {
    let child; let receipt; let expired = false; let settled = false; let grace;
    const notify = event => { try { onEvent?.(event); } catch {} };
    const finish = error => {
      if (settled) return;
      settled = true; clearTimeout(timer); clearTimeout(grace);
      if (error) reject(failure(error)); else resolve(receipt.result);
    };
    const stop = code => {
      if (settled || expired) return;
      expired = true;
      try { child.kill('SIGKILL'); } catch {}
      grace = setTimeout(() => {
        // An unconfirmed child is never reported as successful. Keep the fixed
        // failure visible and release event-loop references without PID reuse.
        if (child.connected) { try { child.disconnect(); } catch {} }
        child.unref();
        finish('cleanup_unconfirmed');
      }, killGraceMs);
      receipt = { ok: false, code };
    };
    const timer = setTimeout(() => stop('cleanup_timeout'), timeoutMs);
    try {
      child = fork(workerModule, [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        execArgv: ['--max-old-space-size=64'], windowsHide: true });
      child.once('spawn', () => notify({ type: 'spawned', pid: child.pid }));
      child.on('message', message => {
        if (expired || settled) return;
        if (receipt || !message || typeof message !== 'object' ||
            message.ok === true && (!validResult(message.result, options.dryRun ?? true) || Object.keys(message).length !== 2) ||
            message.ok === false && (!codes.has(message.code) || Object.keys(message).length !== 2) ||
            typeof message.ok !== 'boolean') { stop('cleanup_failed'); return; }
        receipt = message; notify({ type: 'resultReceived' });
      });
      child.once('error', () => { if (child.pid) stop('cleanup_failed'); else finish('cleanup_failed'); });
      child.once('exit', (code, signal) => {
        notify({ type: 'exited' });
        if (expired) finish(receipt?.code ?? 'cleanup_failed');
        else if (!receipt || signal || receipt.ok && code !== 0 || !receipt.ok && code !== 1) finish('cleanup_failed');
        else finish(receipt.ok ? undefined : receipt.code);
      });
      child.send(options, error => { if (error) stop('cleanup_failed'); });
    } catch { if (child?.pid) stop('cleanup_failed'); else finish('cleanup_failed'); }
  });
}
