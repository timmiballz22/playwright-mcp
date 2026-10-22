// Private IPC fault fixture. No filesystem, browser, shell or descendant effects.
process.once('message', packet => {
  const mode = process.env.PLAYWRIGHT_TEST_JOURNAL_INVALID_PHASE;
  process.send(mode === 'invalid' ? { type: 'journal_init_phase', id: packet.id, stage: 'private-canary' } :
    mode === 'extra' ? { type: 'journal_init_phase', id: packet.id, stage: 'directory', value: 'private-canary' } :
      mode === 'unmatched' ? { type: 'journal_init_phase', id: packet.id + 1, stage: 'configure' } : null);
  setInterval(() => {}, 1000);
});
