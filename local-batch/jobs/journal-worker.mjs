// Fixed metadata transactions only. This process never imports Playwright,
// receives workflow input, or executes SQL supplied by a caller.
import { DatabaseSync } from 'node:sqlite';
import { open, mkdir, lstat, readFile, link, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomBytes, randomUUID, createHash, createHmac } from 'node:crypto';
import path from 'node:path';
import { validCommandData } from './journal-protocol.mjs';
import { FAILURE_KINDS, STEP_FAILURE_CODES, TERMINATION_FAILURE_CODES } from '../failure.mjs';

let db;
let identity;
let key;
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const terminal = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT', 'CRASHED']);
const reasons = new Set([null, 'cancelled', 'timeout', 'validation_failed', 'policy_blocked',
  'action_failed', 'worker_crashed', 'supervisor_failed', 'cleanup_failed', 'journal_unavailable',
  'recovered_interrupted', 'execution_failed', 'queue_expired', 'resource_limit']);
const error = code => { throw Object.assign(new Error(code), { safeCode: code }); };
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const mac = value => createHmac('sha256', key).update(value).digest('hex');
const live = pid => {
  try { process.kill(pid, 0); return true; }
  catch (exception) { return exception.code !== 'ESRCH'; }
};

async function assertPrivate(filename, directory = false, allowHardLinks = false) {
  const stat = await lstat(filename);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()) ||
      !directory && !allowHardLinks && stat.nlink !== 1 ||
      process.platform !== 'win32' && (stat.mode & 0o077)) error('unsafe_store');
  return stat;
}

async function privateKey(directory) {
  const filename = path.join(directory, 'journal.key');
  const temporary = path.join(directory, '.key-' + randomUUID() + '.tmp');
  try {
    await lstat(filename);
  } catch (exception) {
    if (exception.code !== 'ENOENT') throw exception;
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(randomBytes(32)); await file.sync(); }
    finally { await file.close(); }
    try { await link(temporary, filename); }
    catch (exception) { if (exception.code !== 'EEXIST') throw exception; }
    finally { await unlink(temporary); }
  }
  let stat = await assertPrivate(filename, false, true);
  // A competing creator may still be unlinking its exclusive temporary name.
  // This permits that short publication window, never a persistent outside link.
  for (let attempt = 0; stat.nlink !== 1 && attempt < 10; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 20));
    stat = await assertPrivate(filename, false, true);
  }
  if (stat.nlink !== 1) error('unsafe_store');
  if (stat.size !== 32) error('invalid_store_key');
  const file = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try { return await file.readFile(); } finally { await file.close(); }
}

function recoveryDecision(row, lease) {
  if (row.state === 'QUEUED' && !row.started && row.deadline_at <= Date.now()) return 'expired';
  const reusedHolder = lease?.holder_pid === identity.pid && lease.instance !== identity.instance;
  const reusedController = row.controller_pid === identity.pid && row.instance !== identity.instance;
  if (lease && live(lease.holder_pid) && !reusedHolder) return null;
  if (!lease && live(row.controller_pid) && !reusedController) return null;
  return 'crashed';
}
const recoveryRows = () => db.prepare("SELECT * FROM jobs WHERE state IN ('CREATED','VALIDATING','QUEUED','RUNNING') LIMIT 64").all();
const recoveryLease = row => db.prepare('SELECT * FROM execution_lease WHERE job_id=?').get(row.id);
const maintenanceLease = () => db.prepare("SELECT l.* FROM execution_lease l JOIN jobs j ON j.id=l.job_id WHERE l.nonce GLOB 'cleanup:*' AND j.state IN ('SUCCEEDED','FAILED','CANCELLED','TIMED_OUT','CRASHED')").get();
const staleMaintenance = () => {
  const lease = maintenanceLease();
  return lease && !lease.uncertain && !live(lease.holder_pid) ? lease : null;
};
const cleanupBlocked = () => Boolean(db.prepare('SELECT uncertain FROM execution_lease WHERE singleton=1').get()?.uncertain);

function transaction(callback) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = callback(); db.exec('COMMIT'); return result; }
  catch (exception) { try { db.exec('ROLLBACK'); } catch {} throw exception; }
}

function owned(id) {
  if (!uuid.test(id || '')) error('not_found');
  const row = db.prepare('SELECT * FROM jobs WHERE id=? AND owner=?').get(id, identity.owner);
  if (!row) error('not_found');
  return row;
}

function dto(row) {
  return { jobId: row.id, state: row.state, revision: row.revision, stage: row.stage,
    completed: row.completed, total: row.total,
    createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
    deadlineAt: new Date(row.deadline_at).toISOString(), cancelRequested: Boolean(row.cancel_requested),
    reason: row.reason, resultAvailable: row.summary !== null,
    completionCertainty: row.state === 'SUCCEEDED' || !row.started ? 'exact' : 'confirmed_lower_bound',
    ...(row.state !== 'SUCCEEDED' ? { retrySafe: false } : {}), operatorAttentionRequired: Boolean(row.uncertain) };
}

function update(row, state, completed, stage, reason = null) {
  if (!reasons.has(reason)) error('invalid_metadata');
  const revision = row.revision + 1;
  const now = Date.now();
  db.prepare('UPDATE jobs SET state=?,completed=?,stage=?,reason=?,revision=?,updated_at=? WHERE id=?')
    .run(state, completed, stage, reason, revision, now, row.id);
  db.prepare('INSERT INTO events(job_id,revision,state,stage,completed,created_at) VALUES(?,?,?,?,?,?)')
    .run(row.id, revision, state, stage, completed, now);
  return db.prepare('SELECT * FROM jobs WHERE id=?').get(row.id);
}

function leaseFor(row, nonce, active = true) {
  const lease = db.prepare('SELECT * FROM execution_lease WHERE singleton=1').get();
  if (!lease || lease.job_id !== row.id || lease.nonce !== nonce || lease.instance !== identity.instance ||
      active && lease.holder_pid !== identity.pid) error('invalid_lease');
  return lease;
}

function validateSummary(value, row, state, completed) {
  const result = value ?? { ok: state === 'SUCCEEDED', completed, total: row.total };
  if (!result || typeof result !== 'object' || Array.isArray(result)) error('invalid_metadata');
  const allowed = new Set(['schemaVersion', 'runId', 'ok', 'reason', 'browser', 'completed', 'total',
    'durationMs', 'blockedRequests', 'recentSteps', 'failedStep', 'completionCertainty',
    'retrySafe', 'execution', 'stage', 'actionsSucceeded', 'reportScope', 'cleanupFailures', 'reportId']);
  if (Object.keys(result).some(name => !allowed.has(name))) error('invalid_metadata');
  if (result.ok !== (state === 'SUCCEEDED') || result.completed !== completed || result.total !== row.total)
    error('invalid_metadata');
  const optional = (object, field, valid) => {
    if (object[field] !== undefined && !valid(object[field])) error('invalid_metadata');
  };
  optional(result, 'schemaVersion', value => value === 1);
  optional(result, 'runId', value => typeof value === 'string' && uuid.test(value));
  optional(result, 'reportId', value => typeof value === 'string' && uuid.test(value));
  optional(result, 'browser', value => ['chromium', 'firefox', 'webkit'].includes(value));
  optional(result, 'durationMs', value => integer(value, 0, 86400000));
  optional(result, 'blockedRequests', value => integer(value, 0, 2147483647));
  optional(result, 'completionCertainty', value => ['exact', 'confirmed_lower_bound'].includes(value));
  optional(result, 'retrySafe', value => value === false);
  optional(result, 'stage', value => ['workspace', 'execution', 'report'].includes(value));
  optional(result, 'cleanupFailures', value => Array.isArray(value) && value.length <= 4 && value.every(code => ['context_timeout', 'context_error', 'browser_timeout', 'browser_error', 'server_timeout', 'server_error', 'server_kill_timeout', 'server_kill_error'].includes(code)));
  if (result.actionsSucceeded !== undefined && typeof result.actionsSucceeded !== 'boolean' ||
      state === 'SUCCEEDED' && result.actionsSucceeded === false ||
      result.reportScope !== undefined && result.reportScope !== 'worker_execution') error('invalid_metadata');
  if (result.recentSteps !== undefined && (!Array.isArray(result.recentSteps) || result.recentSteps.length > 10)) error('invalid_metadata');
  if (result.failedStep !== undefined && result.failedStep !== null &&
      (typeof result.failedStep !== 'object' || Array.isArray(result.failedStep))) error('invalid_metadata');
  for (const step of [...(result.recentSteps || []), ...(result.failedStep ? [result.failedStep] : [])]) {
    if (!step || typeof step !== 'object' || Array.isArray(step) || Object.keys(step).some(name => !['index', 'repetition', 'type', 'ok', 'durationMs', 'error', 'failureKind', 'httpStatus', 'retryAfterMs'].includes(name)))
      error('invalid_metadata');
    if (!integer(step.index, 0, 1000) || typeof step.ok !== 'boolean' ||
        !['goto', 'click', 'fill', 'press', 'check', 'uncheck', 'hover', 'waitFor', 'assertText', 'assertURL', 'scroll', 'screenshot', 'setup'].includes(step.type)) error('invalid_metadata');
    optional(step, 'repetition', value => integer(value, 1, 100));
    optional(step, 'durationMs', value => integer(value, 0, 86400000));
    optional(step, 'httpStatus', value => integer(value, 100, 599));
    optional(step, 'retryAfterMs', value => integer(value, 0, 86400000));
    if (step.failureKind !== undefined && !FAILURE_KINDS.includes(step.failureKind) ||
        step.error !== undefined && ![...STEP_FAILURE_CODES, 'setup_failed'].includes(step.error)) error('invalid_metadata');
  }
  if (result.execution && Object.keys(result.execution).some(name => !['mode', 'forced', 'cleanup', 'tempCleanup', 'supervisorPid', 'workerPid', 'browserPids', 'workerCleanupFailed', 'terminationFailures'].includes(name)))
    error('invalid_metadata');
  if (result.execution !== undefined) {
    const execution = result.execution;
    if (!execution || typeof execution !== 'object' || Array.isArray(execution)) error('invalid_metadata');
    optional(execution, 'mode', value => value === 'supervised');
    optional(execution, 'forced', value => typeof value === 'boolean');
    optional(execution, 'workerCleanupFailed', value => typeof value === 'boolean');
    optional(execution, 'terminationFailures', value => Array.isArray(value) && value.length <= TERMINATION_FAILURE_CODES.length && value.every(code => TERMINATION_FAILURE_CODES.includes(code)));
    optional(execution, 'cleanup', value => ['terminated', 'failed'].includes(value));
    optional(execution, 'tempCleanup', value => ['removed', 'failed', 'unknown', 'not-created'].includes(value));
    for (const field of ['supervisorPid', 'workerPid']) optional(execution, field, value => integer(value, 2, 2147483647));
    optional(execution, 'browserPids', value => Array.isArray(value) && value.length <= 4 && value.every(pid => integer(pid, 2, 2147483647)));
  }
  if (result.reason !== undefined && !reasons.has(result.reason)) error('invalid_metadata');
  const encoded = JSON.stringify(result);
  if (Buffer.byteLength(encoded) > 32768) error('metadata_too_large');
  return encoded;
}

const handlers = new Map([
  ['init', async data => {
    if (db || !data || typeof data.directory !== 'string' || data.directory.length > 4096 ||
        !/^[0-9a-f]{64}$/.test(data.projectId || '') || typeof data.ownerId !== 'string' ||
        !data.ownerId.length || data.ownerId.length > 128 || !uuid.test(data.instanceId || '') ||
        data.pid !== process.ppid) error('invalid_config');
    const directory = path.resolve(data.directory);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await assertPrivate(directory, true);
    key = await privateKey(directory);
    const filename = path.join(directory, 'jobs.sqlite');
    try { const file = await open(filename, 'wx', 0o600); await file.close(); }
    catch (exception) { if (exception.code !== 'EEXIST') throw exception; }
    if ((await assertPrivate(filename)).size > 16777216) error('store_too_large');
    identity = { owner: mac('owner:' + data.ownerId), instance: data.instanceId, pid: data.pid };
    db = new DatabaseSync(filename, { allowExtension: false });
    // Wait for the write lock before mutation; never reissue an ambiguous command.
    // This remains inside the unchanged two-second journal RPC watchdog.
    db.exec('PRAGMA busy_timeout=750');
    const keyId = createHash('sha256').update(key).digest('hex');
    // Validate the marker before any journal-mode or schema write. A filename
    // alone is not authority to initialize an unrelated application's database.
    db.exec('BEGIN');
    try {
      const version = db.prepare('PRAGMA user_version').get().user_version;
      if (version !== 0 && version !== 1) error('unsupported_schema');
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
      if (tables.length) {
        if (version !== 1 || !['meta', 'jobs', 'events', 'execution_lease'].every(name => tables.includes(name))) error('store_identity_mismatch');
        let project;
        let storedKey;
        try {
          project = db.prepare('SELECT value FROM meta WHERE key=?').get('project')?.value;
          storedKey = db.prepare('SELECT value FROM meta WHERE key=?').get('key_id')?.value;
        } catch { error('store_identity_mismatch'); }
        if (project !== data.projectId || storedKey !== keyId) error('store_identity_mismatch');
      } else if (version !== 0) error('store_identity_mismatch');
    } finally { try { db.exec('ROLLBACK'); } catch {} }
    db.exec('PRAGMA page_size=4096');
    if (db.prepare('PRAGMA page_size').get().page_size !== 4096) error('unsupported_schema');
    db.exec('PRAGMA max_page_count=4096; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF; PRAGMA wal_autocheckpoint=128; PRAGMA journal_size_limit=1048576');
    transaction(() => {
      db.exec([
        'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY,value TEXT NOT NULL)',
        "CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY,owner TEXT NOT NULL,request_key TEXT NOT NULL,fingerprint TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('CREATED','VALIDATING','QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED','TIMED_OUT','CRASHED')),revision INTEGER NOT NULL,stage TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deadline_at INTEGER NOT NULL,total INTEGER NOT NULL,completed INTEGER NOT NULL DEFAULT 0,controller_pid INTEGER NOT NULL,instance TEXT NOT NULL,cancel_requested INTEGER NOT NULL DEFAULT 0,started INTEGER NOT NULL DEFAULT 0,supervisor_pid INTEGER,worker_pid INTEGER,browser_pids TEXT NOT NULL DEFAULT '[]',reason TEXT,summary TEXT,uncertain INTEGER NOT NULL DEFAULT 0,UNIQUE(owner,request_key))",
        'CREATE TABLE IF NOT EXISTS events (job_id TEXT NOT NULL REFERENCES jobs(id),revision INTEGER NOT NULL,state TEXT NOT NULL,stage TEXT NOT NULL,completed INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(job_id,revision))',
        'CREATE TABLE IF NOT EXISTS execution_lease (singleton INTEGER PRIMARY KEY CHECK(singleton=1),job_id TEXT NOT NULL REFERENCES jobs(id),nonce TEXT NOT NULL,instance TEXT NOT NULL,holder_pid INTEGER NOT NULL,uncertain INTEGER NOT NULL DEFAULT 0)',
        'PRAGMA user_version=1',
      ].join(';'));
      const bind = db.prepare('INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)');
      bind.run('project', data.projectId);
      bind.run('key_id', keyId);
      if (db.prepare('SELECT value FROM meta WHERE key=?').get('project').value !== data.projectId ||
          db.prepare('SELECT value FROM meta WHERE key=?').get('key_id').value !== keyId) error('store_identity_mismatch');
    });
    return { schemaVersion: 1 };
  }],
  ['create', data => transaction(() => {
    if (!uuid.test(data.id || '') || typeof data.requestKey !== 'string' || !data.requestKey.length || data.requestKey.length > 128 ||
        !/^[0-9a-f]{64}$/.test(data.workflowDigest || '') || !integer(data.total, 0, 1000) || data.admitNew !== undefined && typeof data.admitNew !== 'boolean' ||
        data.requireCleanLease !== undefined && typeof data.requireCleanLease !== 'boolean' ||
        !integer(data.deadlineAt, Date.now() - 86400000, Date.now() + 86400000)) error('invalid_metadata');
    const requestKey = mac('request:' + identity.owner + ':' + data.requestKey);
    const fingerprint = mac('workflow:' + data.workflowDigest);
    const existing = db.prepare('SELECT * FROM jobs WHERE owner=? AND request_key=?').get(identity.owner, requestKey);
    if (existing) { if (existing.fingerprint !== fingerprint) error('idempotency_conflict'); return dto(existing); }
    const maintenance = maintenanceLease();
    if (maintenance) error(maintenance.uncertain ? 'cleanup_blocked' : 'controller_busy');
    if (data.requireCleanLease && db.prepare('SELECT uncertain FROM execution_lease WHERE singleton=1').get()?.uncertain) error('cleanup_blocked');
    if (data.admitNew === false) error('queue_full');
    if (db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE state='QUEUED'").get().count >= 8) error('queue_full');
    if (db.prepare('SELECT COUNT(*) AS count FROM jobs').get().count >= 10000) error('history_full');
    const now = Date.now();
    db.prepare("INSERT INTO jobs(id,owner,request_key,fingerprint,state,revision,stage,created_at,updated_at,deadline_at,total,controller_pid,instance) VALUES(?,?,?,?,'CREATED',0,'created',?,?,?,?,?,?)")
      .run(data.id, identity.owner, requestKey, fingerprint, now, now, data.deadlineAt, data.total, identity.pid, identity.instance);
    db.prepare("INSERT INTO events(job_id,revision,state,stage,completed,created_at) VALUES(?,0,'CREATED','created',0,?)").run(data.id, now);
    let row = update(owned(data.id), 'VALIDATING', 0, 'validation');
    row = update(row, data.deadlineAt <= now ? 'TIMED_OUT' : 'QUEUED', 0, data.deadlineAt <= now ? 'complete' : 'queued', data.deadlineAt <= now ? 'queue_expired' : null);
    return dto(row);
  })],
  ['verify', data => {
    const row = owned(data.id);
    if (!/^[0-9a-f]{64}$/.test(data.workflowDigest || '')) error('invalid_metadata');
    if (row.fingerprint !== mac('workflow:' + data.workflowDigest)) error('idempotency_conflict');
    return { verified: true };
  }],
  ['read', data => dto(owned(data.id))],
  ['list', (data = {}) => {
    const limit = data.limit ?? 20;
    if (!integer(limit, 1, 20)) error('invalid_metadata');
    return db.prepare('SELECT * FROM jobs WHERE owner=? ORDER BY created_at DESC,id DESC LIMIT ?').all(identity.owner, limit).map(dto);
  }],
  ['retention', data => {
    const limit = data.limit ?? 10;
    if (!integer(data.beforeMs, 1, Date.now()) || !integer(limit, 1, 10)) error('invalid_metadata');
    const after = data.afterId === undefined ? null : owned(data.afterId);
    if (after && !terminal.has(after.state)) error('invalid_metadata');
    // Read-only and owner-bound. Stable terminal timestamps allow bounded
    // continuation without deleting request keys or adding schema tombstones.
    const rows = db.prepare("SELECT * FROM jobs WHERE owner=? AND updated_at<? AND uncertain=0 AND state IN ('SUCCEEDED','FAILED','CANCELLED','TIMED_OUT','CRASHED') AND (? IS NULL OR updated_at>? OR (updated_at=? AND id>?)) ORDER BY updated_at,id LIMIT ?")
      .all(identity.owner, data.beforeMs, after?.updated_at ?? null, after?.updated_at ?? 0, after?.updated_at ?? 0, after?.id ?? '', limit + 1);
    return { jobs: rows.slice(0, limit).map(dto), hasMore: rows.length > limit };
  }],
  ['cleanup_reserve', data => transaction(() => {
    const row = owned(data.id);
    if (!terminal.has(row.state)) error('not_terminal');
    if (!uuid.test(data.nonce || '')) error('invalid_metadata');
    if (row.uncertain) error('cleanup_blocked');
    const lease = db.prepare('SELECT * FROM execution_lease WHERE singleton=1').get();
    if (lease) error(lease.uncertain ? 'cleanup_blocked' : 'controller_busy');
    db.prepare('INSERT INTO execution_lease(singleton,job_id,nonce,instance,holder_pid) VALUES(1,?,?,?,?)')
      .run(row.id, 'cleanup:' + data.nonce, identity.instance, identity.pid);
    return { acquired: true };
  })],
  ['cleanup_release', data => transaction(() => {
    const row = owned(data.id);
    if (!uuid.test(data.nonce || '')) error('invalid_metadata');
    if (!terminal.has(row.state)) error('not_terminal');
    const lease = leaseFor(row, 'cleanup:' + data.nonce);
    if (lease.uncertain || row.uncertain) error('cleanup_blocked');
    db.prepare('DELETE FROM execution_lease WHERE singleton=1').run();
    return { released: true };
  })],
  ['cleanup_uncertain', data => transaction(() => {
    const row = owned(data.id);
    if (!uuid.test(data.nonce || '')) error('invalid_metadata');
    if (!terminal.has(row.state)) error('not_terminal');
    leaseFor(row, 'cleanup:' + data.nonce);
    db.prepare('UPDATE execution_lease SET uncertain=1 WHERE singleton=1').run();
    db.prepare('UPDATE jobs SET uncertain=1 WHERE id=?').run(row.id);
    return { cleanupBlocked: true };
  })],
  ['events', data => {
    const row = owned(data.id);
    return db.prepare('SELECT revision,state,stage,completed,created_at AS createdAt FROM events WHERE job_id=? ORDER BY revision').all(row.id);
  }],
  ['reserve', data => transaction(() => {
    const row = owned(data.id);
    if (row.state !== 'QUEUED' || row.instance !== identity.instance) error('invalid_transition');
    if (!uuid.test(data.nonce || '') || data.queueExpired !== undefined && typeof data.queueExpired !== 'boolean') error('invalid_metadata');
    const lease = db.prepare('SELECT * FROM execution_lease WHERE singleton=1').get();
    if (row.cancel_requested || row.deadline_at <= Date.now() || data.queueExpired === true) {
      if (lease?.job_id === row.id) return { acquired: false, reason: lease.uncertain ? 'cleanup_blocked' : 'project_busy' };
      update(row, row.cancel_requested ? 'CANCELLED' : 'TIMED_OUT', 0, 'complete', row.cancel_requested ? 'cancelled' : 'queue_expired');
      return { acquired: false, reason: 'not_started' };
    }
    if (lease) return { acquired: false, reason: lease.uncertain ? 'cleanup_blocked' : 'project_busy' };
    db.prepare('INSERT INTO execution_lease(singleton,job_id,nonce,instance,holder_pid) VALUES(1,?,?,?,?)')
      .run(row.id, data.nonce, identity.instance, identity.pid);
    update(row, 'QUEUED', 0, 'preparing');
    return { acquired: true };
  })],
  ['activate', data => transaction(() => {
    const row = owned(data.id);
    leaseFor(row, data.nonce, false);
    if (row.state !== 'QUEUED') error('invalid_transition');
    if (row.cancel_requested || row.deadline_at <= Date.now()) {
      const stopped = update(row, row.cancel_requested ? 'CANCELLED' : 'TIMED_OUT', 0, 'complete', row.cancel_requested ? 'cancelled' : 'queue_expired');
      db.prepare('DELETE FROM execution_lease WHERE singleton=1').run();
      return dto(stopped);
    }
    db.prepare('UPDATE execution_lease SET holder_pid=? WHERE singleton=1').run(identity.pid);
    db.prepare('UPDATE jobs SET supervisor_pid=?,started=1 WHERE id=?').run(identity.pid, row.id);
    return dto(update(row, 'RUNNING', 0, 'launch'));
  })],
  ['progress', data => transaction(() => {
    const row = owned(data.id); leaseFor(row, data.nonce);
    if (row.state !== 'RUNNING' || !integer(data.completed, row.completed + 1, row.total)) error('invalid_progress');
    return dto(update(row, 'RUNNING', data.completed, 'actions'));
  })],
  ['resources', data => transaction(() => {
    const row = owned(data.id); leaseFor(row, data.nonce);
    if (row.state !== 'RUNNING') error('invalid_transition');
    if (data.workerPid !== undefined) {
      if (!integer(data.workerPid, 2, 2147483647) || row.worker_pid && row.worker_pid !== data.workerPid) error('invalid_metadata');
      db.prepare('UPDATE jobs SET worker_pid=? WHERE id=?').run(data.workerPid, row.id);
    }
    if (data.browserPid !== undefined) {
      const pids = JSON.parse(row.browser_pids);
      if (!integer(data.browserPid, 2, 2147483647) || pids.length >= 4 && !pids.includes(data.browserPid)) error('invalid_metadata');
      if (!pids.includes(data.browserPid)) pids.push(data.browserPid);
      db.prepare('UPDATE jobs SET browser_pids=? WHERE id=?').run(JSON.stringify(pids), row.id);
    }
    return { recorded: true };
  })],
  ['cancel', data => transaction(() => {
    const row = owned(data.id);
    if (terminal.has(row.state) || row.cancel_requested) return dto(row);
    db.prepare('UPDATE jobs SET cancel_requested=1 WHERE id=?').run(row.id);
    const lease = db.prepare('SELECT job_id FROM execution_lease WHERE singleton=1').get();
    return dto(update(row, row.state === 'QUEUED' && lease?.job_id !== row.id ? 'CANCELLED' : row.state,
      row.completed, row.state === 'QUEUED' && lease?.job_id !== row.id ? 'complete' : 'cancel_requested',
      row.state === 'QUEUED' && lease?.job_id !== row.id ? 'cancelled' : null));
  })],
  ['finish', data => transaction(() => {
    const row = owned(data.id); leaseFor(row, data.nonce);
    if (!terminal.has(data.state) || terminal.has(row.state) || !integer(data.completed, row.completed, row.total) ||
        data.state === 'SUCCEEDED' && (row.state !== 'RUNNING' || data.completed !== row.total || row.cancel_requested || row.deadline_at <= Date.now()) ||
        typeof data.cleanupOk !== 'boolean') error('invalid_transition');
    const summary = validateSummary(data.summary, row, data.state, data.completed);
    const reason = data.reason ?? (data.state === 'CANCELLED' ? 'cancelled' : data.state === 'TIMED_OUT' ? 'timeout' : data.state === 'CRASHED' ? 'worker_crashed' : data.state === 'FAILED' ? 'execution_failed' : null);
    db.prepare('UPDATE jobs SET summary=?,uncertain=? WHERE id=?').run(summary, data.cleanupOk ? 0 : 1, row.id);
    const finished = update(row, data.state, data.completed, 'complete', reason);
    if (data.cleanupOk) db.prepare('DELETE FROM execution_lease WHERE singleton=1').run();
    else db.prepare('UPDATE execution_lease SET uncertain=1 WHERE singleton=1').run();
    return dto(finished);
  })],
  ['result', data => { const row = owned(data.id); if (!terminal.has(row.state)) error('not_ready'); if (!row.summary) error('result_expired'); return JSON.parse(row.summary); }],
  ['recover', () => {
    // Polls with no state change must not contend with durable writers. This
    // read-only preflight grants no lease and never schedules execution.
    if (!staleMaintenance() && !recoveryRows().some(row => recoveryDecision(row, recoveryLease(row)))) return { recovered: 0, cleanupBlocked: cleanupBlocked() };
    return transaction(() => {
    let recovered = 0;
    const maintenance = staleMaintenance();
    if (maintenance) {
      // A dead holder is not authority to release or kill its old resources.
      // Retain the reservation and surface uncertainty without replay.
      db.prepare('UPDATE execution_lease SET uncertain=1 WHERE singleton=1').run();
      db.prepare('UPDATE jobs SET uncertain=1 WHERE id=?').run(maintenance.job_id);
      recovered++;
    }
    // A possible mutation is re-read and rechecked under the write transaction.
    for (const row of recoveryRows()) {
      const lease = recoveryLease(row);
      const decision = recoveryDecision(row, lease);
      // Expired unstarted work cannot acquire a worker after this transaction.
      // activate() checks the same deadline before persisting RUNNING.
      if (decision === 'expired') {
        update(row, 'TIMED_OUT', 0, 'complete', 'queue_expired');
        if (lease) db.prepare('DELETE FROM execution_lease WHERE singleton=1').run();
        recovered++;
        continue;
      }
      if (decision !== 'crashed') continue;
      const uncertain = row.started || row.worker_pid !== null;
      db.prepare('UPDATE jobs SET uncertain=? WHERE id=?').run(uncertain ? 1 : 0, row.id);
      update(row, 'CRASHED', row.completed, 'complete', 'recovered_interrupted');
      if (lease) {
        if (uncertain) db.prepare('UPDATE execution_lease SET uncertain=1 WHERE singleton=1').run();
        else db.prepare('DELETE FROM execution_lease WHERE singleton=1').run();
      }
      recovered++;
    }
    return { recovered, cleanupBlocked: cleanupBlocked() };
    });
  }],
  ['integrity', () => ({ ok: db.prepare('PRAGMA quick_check').get().quick_check === 'ok' })],
  ['close', () => { db.close(); db = undefined; return { closed: true }; }],
]);

function safeCode(exception) {
  if (exception.safeCode) return exception.safeCode;
  const sqlite = Number(exception.errcode) & 255;
  if (sqlite === 5 || sqlite === 6) return 'journal_busy';
  if (sqlite === 11 || sqlite === 26) return 'journal_corrupt';
  if (sqlite === 13) return 'storage_full';
  return 'journal_unavailable';
}

process.once('disconnect', () => { try { db?.close(); } catch {} });
process.on('message', async packet => {
  let reply;
  try {
    const handler = handlers.get(packet.command);
    if (!handler) error('unsupported_command');
    if (!validCommandData(packet.command, packet.data)) error('invalid_metadata');
    if (packet.command !== 'init' && !db) error('journal_not_ready');
    reply = { id: packet.id, ok: true, value: await handler(packet.data) };
  } catch (exception) { reply = { id: packet.id, ok: false, code: safeCode(exception) }; }
  if (process.connected) process.send(reply, () => { if (packet.command === 'close' && process.connected) process.disconnect(); });
});
