// Trusted Windows layout probe only. No raw error text, argv or paths are saved.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import '../execution-worker.mjs';
let workspace;
process.prependOnceListener('message', packet => { workspace = packet.workspaceRoot; });
const launchServer = chromium.launchServer.bind(chromium);
chromium.launchServer = async (...args) => {
  try { return await launchServer(...args); }
  catch (error) {
    const message = String(error?.message ?? '');
    await writeFile(path.join(workspace, 'launch-fixture.json'), JSON.stringify({
      name: error?.name === 'TimeoutError' ? 'TimeoutError' : 'Error',
      code: ['ENOENT', 'EACCES', 'EPERM', 'ENAMETOOLONG'].includes(error?.code) ? error.code : null,
      temporaryDirectoryCharacters: (process.env.TEMP ?? '').length,
      profileMentioned: /profile/i.test(message), directoryMentioned: /directory|mkdir|path/i.test(message),
      pathLengthMentioned: /too long|ENAMETOOLONG|filename.*extension/i.test(message),
      accessDeniedMentioned: /access.*denied|EACCES|EPERM/i.test(message),
    }), { flag: 'wx', mode: 0o600 });
    throw error;
  }
};
