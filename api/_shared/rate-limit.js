const counters = new Map();

function sweepExpired(now) {
  for (const [key, entry] of counters.entries()) {
    if (entry.expiresAt <= now) counters.delete(key);
  }
}

function takeRateLimit({ bucket, limit, windowMs, now = Date.now() }) {
  if (!bucket) return { allowed: true, remaining: limit };
  if (!Number.isFinite(limit) || limit <= 0) return { allowed: true, remaining: 0 };
  if (!Number.isFinite(windowMs) || windowMs <= 0) return { allowed: true, remaining: 0 };

  sweepExpired(now);

  const current = counters.get(bucket);
  if (!current || current.expiresAt <= now) {
    const next = {
      count: 1,
      expiresAt: now + windowMs,
    };
    counters.set(bucket, next);
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      reset_ms: windowMs,
    };
  }

  current.count += 1;
  counters.set(bucket, current);

  if (current.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retry_after_ms: Math.max(0, current.expiresAt - now),
      reset_ms: Math.max(0, current.expiresAt - now),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    reset_ms: Math.max(0, current.expiresAt - now),
  };
}

function clearRateLimitState() {
  counters.clear();
}

module.exports = {
  takeRateLimit,
  clearRateLimitState,
};
