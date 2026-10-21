import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Filesystem calls can stall independently of the supervisor's event loop.
// Success requires a valid receipt and natural exit; false retains uncertainty.
export async function cleanupTemporaryDirectory(directory, timeoutMs = 2000, diagnosticPath) {
  return await new Promise(resolve => {
    let child; let reported; let expired = false; let settled = false; let grace;
    const finish = ok => {
      if (settled) return;
      settled = true; clearTimeout(timer); clearTimeout(grace); resolve(ok);
    };
    const stop = () => {
      if (settled || expired) return;
      expired = true; clearTimeout(timer);
      if (!child?.pid) { finish(false); return; }
      try { child.kill('SIGKILL'); } catch {}
      if (settled) return;
      grace = setTimeout(() => {
        // No numeric-PID fallback or successful cleanup claim. Stop retaining
        // the parent's event loop after bounded owned-handle confirmation.
        if (child.connected) { try { child.disconnect(); } catch {} }
        try { child.unref(); } catch {}
        finish(false);
      }, 1000);
    };
    const duration = Math.max(1, timeoutMs);
    const deadline = performance.now() + duration;
    const timer = setTimeout(stop, duration);
    try {
      child = fork(fileURLToPath(new URL('./cleanup-worker.mjs', import.meta.url)), [], {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: ['--max-old-space-size=64'], windowsHide: true,
      });
      child.on('message', message => {
        if (expired || settled) return;
        if (reported !== undefined || !message || typeof message !== 'object' || Array.isArray(message) ||
            Object.keys(message).join(',') !== 'ok' || typeof message.ok !== 'boolean') { stop(); return; }
        reported = message.ok;
      });
      child.on('error', () => { if (settled) return; if (child.pid) stop(); else finish(false); });
      // Drain final IPC even if its process-exit notification arrived first.
      child.once('close', (code, signal) => finish(!expired && performance.now() <= deadline && reported === true && code === 0 && !signal));
      child.send({ directory, diagnosticPath }, error => { if (error) stop(); });
    } catch { if (child?.pid) stop(); else finish(false); }
  });
}
