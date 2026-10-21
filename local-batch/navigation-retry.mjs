// Trusted operator configuration, never workflow/tool input. No mutation retries.
export function navigationRetryPolicy(input) {
  if (input === undefined) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['maxRetries', 'baseDelayMs', 'maxDelayMs'].includes(key)))
    throw new TypeError('Invalid navigation retry policy');
  const { maxRetries, baseDelayMs = 500, maxDelayMs = 10000 } = input;
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 2 ||
      !Number.isInteger(baseDelayMs) || baseDelayMs < 100 || baseDelayMs > 10000 ||
      !Number.isInteger(maxDelayMs) || maxDelayMs < baseDelayMs || maxDelayMs > 30000)
    throw new TypeError('Invalid navigation retry policy');
  return Object.freeze({ maxRetries, baseDelayMs, maxDelayMs });
}

export function parseRetryAfter(value, now = Date.now()) {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (/^\d+$/.test(raw)) {
    const milliseconds = Number(raw) * 1000;
    return Number.isSafeInteger(milliseconds) ? milliseconds : Infinity;
  }
  // IMF-fixdate; arbitrary strings and decimal delays are not HTTP dates.
  if (!/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(raw)) return undefined;
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}

export function navigationRetryDelay(status, retryAfter, attempt, policy, now = Date.now(), random = Math.random()) {
  if (!policy || attempt >= policy.maxRetries || ![429, 503].includes(status)) return null;
  const serverWait = parseRetryAfter(retryAfter, now);
  const backoff = policy.baseDelayMs * 2 ** attempt + Math.floor(policy.baseDelayMs * 0.5 * random);
  const wait = Math.max(serverWait ?? 0, backoff);
  // Reject rather than violate a server's minimum wait or exceed the local cap.
  return Number.isSafeInteger(wait) && wait <= policy.maxDelayMs ? wait : null;
}
