// Trusted terminal-job artifact scope only. No browser, workflow or shell input.
import { cleanupJobArtifacts } from './artifact-cleanup.mjs';
process.once('disconnect', () => process.exit(1));
process.once('message', async options => {
  let response;
  try { response = { ok: true, result: await cleanupJobArtifacts(options) }; }
  catch (error) { response = { ok: false, code: ['invalid_metadata', 'unsafe_artifacts', 'cleanup_limit'].includes(error?.code) ? error.code : 'cleanup_failed' }; }
  if (process.connected) process.send(response, () => process.exit(response.ok ? 0 : 1));
  else process.exit(1);
});
