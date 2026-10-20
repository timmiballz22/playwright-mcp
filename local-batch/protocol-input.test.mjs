import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

function start() {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./mcp.mjs', import.meta.url))], { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.on('error', () => {}); // Oversize closure may race a pending write.
  let stderr = '';
  child.stderr.on('data', data => { stderr += data; });
  return { child, exited: once(child, 'exit'), stderr: () => stderr };
}

test('malformed MCP input cannot echo page-like secrets or corrupt later protocol frames', { timeout: 10000 }, async () => {
  const { child, exited, stderr } = start();
  const lines = createInterface({ input: child.stdout });
  const replies = [];
  let pinged;
  const ping = new Promise(resolve => { pinged = resolve; });
  lines.on('line', line => { const message = JSON.parse(line); replies.push(message); if (message.id === 2) pinged(); });
  const send = value => child.stdin.write(JSON.stringify(value) + '\n');
  let timer;
  try {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'protocol-test', version: '1' } } });
    child.stdin.write('{"fake-secret-protocol-canary":\n');
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'ping' });
    await Promise.race([ping, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Valid ping was not serviced after malformed input')), 5000); })]);
    assert.deepEqual(replies.map(message => message.id), [1, 2]);
    assert.equal(JSON.stringify(replies).includes('fake-secret-protocol-canary'), false);
    assert.equal(stderr().includes('fake-secret-protocol-canary'), false);
    child.stdin.end();
    assert.deepEqual(await exited, [0, null]);
  } finally { clearTimeout(timer); child.kill('SIGKILL'); lines.close(); }
});

test('oversized unterminated MCP frame closes the transport without launching browsers', { timeout: 10000 }, async () => {
  const { child, exited, stderr } = start();
  child.stdout.resume();
  let timer;
  try {
    // The pinned SDK's default read-buffer ceiling is 10 MiB.
    child.stdin.write(Buffer.alloc(10 * 1024 * 1024 + 1, 65));
    const result = await Promise.race([exited, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Oversized frame did not close transport')), 5000); })]);
    assert.deepEqual(result, [0, null]);
    assert.equal(stderr().length, 0);
  } finally { clearTimeout(timer); child.kill('SIGKILL'); }
});
