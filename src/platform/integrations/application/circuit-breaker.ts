export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type CircuitBreakerConfig = Readonly<{
  failureThreshold: number;
  openDurationMs: number;
  halfOpenSuccessThreshold: number;
}>;

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = Object.freeze({
  failureThreshold: 5,
  openDurationMs: 30_000,
  halfOpenSuccessThreshold: 2,
});

export type CircuitBreakerSnapshot = Readonly<{
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveHalfOpenSuccesses: number;
  openedAt: Date | null;
  lastFailureAt: Date | null;
  lastSuccessAt: Date | null;
}>;

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private consecutiveHalfOpenSuccesses = 0;
  private openedAt: Date | null = null;
  private lastFailureAt: Date | null = null;
  private lastSuccessAt: Date | null = null;
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  snapshot(now: Date = new Date()): CircuitBreakerSnapshot {
    this.maybeRecover(now);
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveHalfOpenSuccesses: this.consecutiveHalfOpenSuccesses,
      openedAt: this.openedAt,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
    };
  }

  canExecute(now: Date = new Date()): boolean {
    this.maybeRecover(now);
    return this.state !== 'OPEN';
  }

  recordSuccess(now: Date = new Date()): void {
    this.lastSuccessAt = now;
    if (this.state === 'HALF_OPEN') {
      this.consecutiveHalfOpenSuccesses += 1;
      if (this.consecutiveHalfOpenSuccesses >= this.config.halfOpenSuccessThreshold) {
        this.state = 'CLOSED';
        this.consecutiveFailures = 0;
        this.consecutiveHalfOpenSuccesses = 0;
        this.openedAt = null;
      }
      return;
    }
    this.consecutiveFailures = 0;
  }

  recordFailure(now: Date = new Date()): void {
    this.lastFailureAt = now;
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.openedAt = now;
      this.consecutiveHalfOpenSuccesses = 0;
      this.consecutiveFailures = this.config.failureThreshold;
      return;
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = now;
    }
  }

  private maybeRecover(now: Date): void {
    if (this.state !== 'OPEN' || !this.openedAt) return;
    const elapsed = now.getTime() - this.openedAt.getTime();
    if (elapsed >= this.config.openDurationMs) {
      this.state = 'HALF_OPEN';
      this.consecutiveHalfOpenSuccesses = 0;
    }
  }
}

export class CircuitBreakerRegistry {
  private readonly breakers = new Map<string, CircuitBreaker>();

  for(key: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    let breaker = this.breakers.get(key);
    if (!breaker) {
      breaker = new CircuitBreaker(config);
      this.breakers.set(key, breaker);
    }
    return breaker;
  }

  snapshot(): ReadonlyMap<string, CircuitBreakerSnapshot> {
    const result = new Map<string, CircuitBreakerSnapshot>();
    for (const [key, breaker] of this.breakers.entries()) {
      result.set(key, breaker.snapshot());
    }
    return result;
  }
}

export const integrationCircuitBreakers = new CircuitBreakerRegistry();
