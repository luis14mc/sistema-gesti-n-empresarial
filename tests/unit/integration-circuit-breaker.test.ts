// Phase 10B — domain unit tests for the circuit breaker.
import { describe, expect, it } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from '@/platform/integrations/application/circuit-breaker';

describe('CircuitBreaker lifecycle', () => {
  it('starts in CLOSED state', () => {
    const breaker = new CircuitBreaker();
    expect(breaker.snapshot().state).toBe('CLOSED');
    expect(breaker.canExecute()).toBe(true);
  });

  it('opens once the failure threshold is reached', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, openDurationMs: 60_000 });
    const now = new Date('2026-07-24T00:00:00Z');
    breaker.recordFailure(now);
    breaker.recordFailure(now);
    expect(breaker.snapshot(now).state).toBe('CLOSED');
    breaker.recordFailure(now);
    expect(breaker.snapshot(now).state).toBe('OPEN');
    expect(breaker.canExecute(now)).toBe(false);
  });

  it('moves to HALF_OPEN after openDuration and closes on the required successes', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, openDurationMs: 1_000, halfOpenSuccessThreshold: 2 });
    const t0 = new Date('2026-07-24T00:00:00Z');
    breaker.recordFailure(t0);
    breaker.recordFailure(t0);
    expect(breaker.snapshot(t0).state).toBe('OPEN');
    const t1 = new Date('2026-07-24T00:00:02Z');
    expect(breaker.snapshot(t1).state).toBe('HALF_OPEN');
    breaker.recordSuccess(t1);
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

  it('resets the consecutive failure counter on a success in CLOSED state', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, openDurationMs: 60_000 });
    const now = new Date('2026-07-24T00:00:00Z');
    breaker.recordFailure(now);
    breaker.recordFailure(now);
    breaker.recordSuccess(now);
    breaker.recordFailure(now);
    expect(breaker.snapshot(now).state).toBe('CLOSED');
  });

  it('uses the documented defaults when none are given', () => {
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold).toBe(5);
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.openDurationMs).toBe(30_000);
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.halfOpenSuccessThreshold).toBe(2);
  });
});

describe('CircuitBreakerRegistry', () => {
  it('returns the same breaker instance for the same key', () => {
    const registry = new CircuitBreakerRegistry();
    const a = registry.for('MICROSOFT_GRAPH:int-1');
    const b = registry.for('MICROSOFT_GRAPH:int-1');
    expect(a).toBe(b);
  });

  it('keeps separate breakers for different keys', () => {
    const registry = new CircuitBreakerRegistry();
    const a = registry.for('MICROSOFT_GRAPH:int-1');
    const b = registry.for('AWS_S3:int-1');
    expect(a).not.toBe(b);
  });

  it('snapshots every breaker at once', () => {
    const registry = new CircuitBreakerRegistry();
    registry.for('k1').recordFailure();
    registry.for('k2');
    const snap = registry.snapshot();
    expect(snap.has('k1')).toBe(true);
    expect(snap.has('k2')).toBe(true);
  });
});
