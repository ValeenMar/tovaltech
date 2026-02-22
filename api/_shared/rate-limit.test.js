import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { takeRateLimit, clearRateLimitState } = require('./rate-limit');

describe('rate limit helper', () => {
  beforeEach(() => {
    clearRateLimitState();
  });

  it('allows requests under the limit', () => {
    const first = takeRateLimit({
      bucket: 'ip:1',
      limit: 2,
      windowMs: 1000,
      now: 100,
    });
    const second = takeRateLimit({
      bucket: 'ip:1',
      limit: 2,
      windowMs: 1000,
      now: 200,
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
  });

  it('blocks when exceeding the limit and resets later', () => {
    takeRateLimit({ bucket: 'ip:2', limit: 1, windowMs: 1000, now: 100 });
    const blocked = takeRateLimit({ bucket: 'ip:2', limit: 1, windowMs: 1000, now: 101 });
    const afterReset = takeRateLimit({ bucket: 'ip:2', limit: 1, windowMs: 1000, now: 1205 });

    expect(blocked.allowed).toBe(false);
    expect(blocked.retry_after_ms).toBeGreaterThan(0);
    expect(afterReset.allowed).toBe(true);
  });
});
