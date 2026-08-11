import { describe, expect, it } from 'vitest';
import { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG, integrationCircuitBreakers } from '@/platform/integrations/application/circuit-breaker';
import { classifyFailure, shouldRetry, DEFAULT_RETRY_POLICY } from '@/platform/integrations/application/retry-policy';

describe('classifyFailure', () => {
  it('classifies transient HTTP statuses', () => {
    expect(classifyFailure({ status: 429 })).toBe('TRANSIENT');
    expect(classifyFailure({ status: 502 })).toBe('TRANSIENT');
    expect(classifyFailure({ status: 503 })).toBe('TRANSIENT');
    expect(classifyFailure({ status: 504 })).toBe('TRANSIENT');
  });

  it('classifies permanent HTTP statuses', () => {
    expect(classifyFailure({ status: 400 })).toBe('PERMANENT');
    expect(classifyFailure({ status: 401 })).toBe('PERMANENT');
    expect(classifyFailure({ status: 403 })).toBe('PERMANENT');
    expect(classifyFailure({ status: 404 })).toBe('PERMANENT');
  });

  it('classifies network causes without a status as transient', () => {
    expect(classifyFailure({ cause: 'timeout' })).toBe('TRANSIENT');
    expect(classifyFailure({ cause: 'connection' })).toBe('TRANSIENT');
  });

  it('classifies abort as permanent', () => {
    expect(classifyFailure({ cause: 'abort' })).toBe('PERMANENT');
  });
});

describe('shouldRetry', () => {
  it('does not retry past maxAttempts', () => {
    const decision = shouldRetry({ attempt: DEFAULT_RETRY_POLICY.maxAttempts, classification: 'TRANSIENT' });
    expect(decision.retry).toBe(false);
    expect(decision.reason).toBe('MAX_ATTEMPTS');
  });

  it('does not retry permanent failures', () => {
    const decision = shouldRetry({ attempt: 1, classification: 'PERMANENT' });
    expect(decision.retry).toBe(false);
    expect(decision.reason).toBe('PERMANENT');
  });

  it('retries transient failures with exponential backoff', () => {
    const decision = shouldRetry({ attempt: 1, classification: 'TRANSIENT' });
    expect(decision.retry).toBe(true);
    expect(decision.delayMs).toBeGreaterThanOrEqual(DEFAULT_RETRY_POLICY.baseDelayMs * 0.8);
    expect(decision.delayMs).toBeLessThanOrEqual(DEFAULT_RETRY_POLICY.baseDelayMs * 1.2);
  });
});

describe('CircuitBreaker', () => {
  it('opens after the failure threshold and rejects calls during openDuration', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, openDurationMs: 60_000 });
    const now = new Date('2026-07-24T00:00:00Z');
    breaker.recordFailure(now);
    breaker.recordFailure(now);
    expect(breaker.snapshot(now).state).toBe('OPEN');
    expect(breaker.canExecute(now)).toBe(false);
  });

  it('moves to HALF_OPEN after openDuration and closes on required successes', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, openDurationMs: 1_000, halfOpenSuccessThreshold: 1 });
    const t0 = new Date('2026-07-24T00:00:00Z');
    breaker.recordFailure(t0);
    breaker.recordFailure(t0);
    expect(breaker.snapshot(t0).state).toBe('OPEN');
    const t1 = new Date('2026-07-24T00:00:02Z');
    expect(breaker.snapshot(t1).state).toBe('HALF_OPEN');
    breaker.recordSuccess(t1);
    expect(breaker.snapshot(t1).state).toBe('CLOSED');
  });

  it('reopens immediately on a failure during HALF_OPEN', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, openDurationMs: 1_000, halfOpenSuccessThreshold: 1 });
    const t0 = new Date('2026-07-24T00:00:00Z');
    breaker.recordFailure(t0);
    breaker.recordFailure(t0);
    const t1 = new Date('2026-07-24T00:00:02Z');
    expect(breaker.snapshot(t1).state).toBe('HALF_OPEN');
    breaker.recordFailure(t1);
    expect(breaker.snapshot(t1).state).toBe('OPEN');
  });
});

describe('integrationCircuitBreakers registry', () => {
  it('returns the same breaker instance for the same key', () => {
    const a = integrationCircuitBreakers.for('MICROSOFT_GRAPH:int-1');
    const b = integrationCircuitBreakers.for('MICROSOFT_GRAPH:int-1');
    expect(a).toBe(b);
  });

  it('keeps separate breakers for different providers or integrations', () => {
    const a = integrationCircuitBreakers.for('MICROSOFT_GRAPH:int-1');
    const b = integrationCircuitBreakers.for('AWS_S3:int-1');
    expect(a).not.toBe(b);
  });
});

void DEFAULT_CIRCUIT_BREAKER_CONFIG;
