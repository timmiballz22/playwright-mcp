import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Filesystem calls can stall independently of the supervisor's event loop.
// Contain them in a child that can be terminated within its cleanup budget.
export async function cleanupTemporaryDirectory(directory, timeoutMs = 2000) {
  return await new Promise(resolve => {
    let reported = false;
    let expired = false;
    const child = fork(fileURLToPath(new URL('./cleanup-worker.mjs', import.meta.url)), [], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: ['--max-old-space-size=64'], windowsHide: true,
    });
    const timer = setTimeout(() => { expired = true; child.kill('SIGKILL'); }, Math.max(1, timeoutMs));
    child.on('message', message => { reported = message.ok === true; });
    child.once('error', () => { clearTimeout(timer); resolve(false); });
    child.once('exit', code => { clearTimeout(timer); resolve(!expired && reported && code === 0); });
    child.send({ directory }, () => {});
  });
}
