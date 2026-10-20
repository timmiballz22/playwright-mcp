// Trusted failure-injection fixture. Never selected through workflow/tool input.
import { spawn } from 'node:child_process';
export function fault(mode) {
  process.once('message', packet => {
    if (packet.type !== 'start') return;
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      detached: process.platform !== 'win32', stdio: 'ignore', windowsHide: true,
    });
    child.once('spawn', () => process.send({ type: 'ownedProcess', pid: child.pid }, () => {
      if (mode === 'crash') process.exit(27);
      if (mode === 'report-stall') {
        process.send({ type: 'result', summary: { ok: true, completed: 1, total: 1, recentSteps: [], failedStep: null } }, () => { while (true) {} });
      } else {
        while (true) {}
      }
    }));
  });
}
