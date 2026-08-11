// Phase 10B — domain unit tests for the integration retry policy.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyFailure,
  DEFAULT_RETRY_POLICY,
  shouldRetry,
  type RetryPolicy,
} from '@/platform/integrations/application/retry-policy';

describe('classifyFailure', () => {
  it('classifies transient HTTP statuses', () => {
    for (const status of [408, 425, 429, 500, 502, 503, 504, 507, 511]) {
      expect(classifyFailure({ status })).toBe('TRANSIENT');
    }
  });

  it('classifies permanent HTTP statuses', () => {
    for (const status of [400, 401, 403, 404, 405, 406, 409, 410, 415, 422, 451]) {
      expect(classifyFailure({ status })).toBe('PERMANENT');
    }
  });

  it('classifies network causes without a status as transient', () => {
    expect(classifyFailure({ cause: 'timeout' })).toBe('TRANSIENT');
    expect(classifyFailure({ cause: 'connection' })).toBe('TRANSIENT');
  });

  it('classifies abort as permanent', () => {
    expect(classifyFailure({ cause: 'abort' })).toBe('PERMANENT');
  });

  it('classifies unknown as UNKNOWN', () => {
    expect(classifyFailure({ cause: 'unknown' })).toBe('UNKNOWN');
    expect(classifyFailure({})).toBe('UNKNOWN');
  });
});

describe('shouldRetry — boundary conditions', () => {
  it('does not retry past maxAttempts', () => {
    const decision = shouldRetry({ attempt: DEFAULT_RETRY_POLICY.maxAttempts, classification: 'TRANSIENT' });
    expect(decision).toEqual({ retry: false, reason: 'MAX_ATTEMPTS', delayMs: 0 });
  });

  it('does not retry permanent failures', () => {
    expect(shouldRetry({ attempt: 1, classification: 'PERMANENT' })).toEqual({
      retry: false,
      reason: 'PERMANENT',
      delayMs: 0,
    });
  });

  it('does not retry UNKNOWN failures', () => {
    expect(shouldRetry({ attempt: 1, classification: 'UNKNOWN' })).toEqual({
      retry: false,
      reason: 'UNKNOWN',
      delayMs: 0,
    });
  });

  it('produces a bounded exponential backoff when transient', () => {
    const policy: RetryPolicy = { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 1_000, jitterRatio: 0 };
    const decision = shouldRetry({ attempt: 3, classification: 'TRANSIENT', policy });
    expect(decision.retry).toBe(true);
    expect(decision.reason).toBe('TRANSIENT');
    expect(decision.delayMs).toBe(100 * 2 ** 2);
  });

  it('caps the delay at maxDelayMs', () => {
    const policy: RetryPolicy = { maxAttempts: 100, baseDelayMs: 1_000, maxDelayMs: 500, jitterRatio: 0 };
    const decision = shouldRetry({ attempt: 10, classification: 'TRANSIENT', policy });
    expect(decision.delayMs).toBe(500);
  });
});

describe('shouldRetry — deterministic jitter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('respects the configured jitterRatio deterministically', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const policy: RetryPolicy = { maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 5_000, jitterRatio: 0.2 };
    const decision = shouldRetry({ attempt: 1, classification: 'TRANSIENT', policy });
    // jitter = 200 * 0.2 = 40; offset = (0.5 * 2 - 1) * 40 = 0
    expect(decision.delayMs).toBe(200);
  });

  it('does not produce a negative delay', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const policy: RetryPolicy = { maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 5_000, jitterRatio: 0.5 };
    const decision = shouldRetry({ attempt: 1, classification: 'TRANSIENT', policy });
    expect(decision.delayMs).toBeGreaterThanOrEqual(0);
  });
});

describe('DEFAULT_RETRY_POLICY', () => {
  it('caps at three attempts and 5 seconds', () => {
    expect(DEFAULT_RETRY_POLICY.maxAttempts).toBe(3);
    expect(DEFAULT_RETRY_POLICY.maxDelayMs).toBe(5_000);
  });

  it('uses a 20% jitter to avoid thundering herd', () => {
    expect(DEFAULT_RETRY_POLICY.jitterRatio).toBeCloseTo(0.2);
  });
});

beforeEach(() => {
  vi.restoreAllMocks();
});
