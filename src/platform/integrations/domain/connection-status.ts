import type { IntegrationHealth, IntegrationProvider } from './integration-types';

export const INTEGRATION_HEALTH_VALUES: readonly IntegrationHealth[] = [
  'HEALTHY',
  'DEGRADED',
  'UNAVAILABLE',
  'DISABLED',
  'UNKNOWN',
];

export function isIntegrationHealth(value: string): value is IntegrationHealth {
  return (INTEGRATION_HEALTH_VALUES as readonly string[]).includes(value);
}

export type HealthComputation = Readonly<{
  health: IntegrationHealth;
  reasons: readonly string[];
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  recentFailureRate: number;
}>;

export const HEALTH_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const HEALTH_DEGRADED_FAILURE_RATE = 0.25;
export const HEALTH_UNAVAILABLE_FAILURE_RATE = 0.75;

export function computeHealth(input: {
  status: 'DRAFT' | 'ACTIVE' | 'DEGRADED' | 'DISABLED' | 'ERROR';
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  recentSuccesses: number;
  recentFailures: number;
}): HealthComputation {
  if (input.status === 'DISABLED' || input.circuitState === 'OPEN') {
    return {
      health: 'UNAVAILABLE',
      reasons: input.circuitState === 'OPEN' ? ['circuit_open'] : ['integration_disabled'],
      lastSuccessAt: input.lastSuccessAt,
      lastFailureAt: input.lastFailureAt,
      recentFailureRate: failureRate(input.recentSuccesses, input.recentFailures),
    };
  }
  if (input.status === 'DRAFT') {
    return {
      health: 'UNKNOWN',
      reasons: ['integration_draft'],
      lastSuccessAt: input.lastSuccessAt,
      lastFailureAt: input.lastFailureAt,
      recentFailureRate: failureRate(input.recentSuccesses, input.recentFailures),
    };
  }
  const total = input.recentSuccesses + input.recentFailures;
  const rate = failureRate(input.recentSuccesses, input.recentFailures);
  if (total === 0 && !input.lastSuccessAt) {
    return {
      health: 'UNKNOWN',
      reasons: ['no_executions'],
      lastSuccessAt: input.lastSuccessAt,
      lastFailureAt: input.lastFailureAt,
      recentFailureRate: rate,
    };
  }
  if (rate >= HEALTH_UNAVAILABLE_FAILURE_RATE) {
    return {
      health: 'UNAVAILABLE',
      reasons: ['high_failure_rate'],
      lastSuccessAt: input.lastSuccessAt,
      lastFailureAt: input.lastFailureAt,
      recentFailureRate: rate,
    };
  }
  if (rate >= HEALTH_DEGRADED_FAILURE_RATE || input.status === 'DEGRADED' || input.status === 'ERROR') {
    return {
      health: 'DEGRADED',
      reasons: ['elevated_failure_rate'],
      lastSuccessAt: input.lastSuccessAt,
      lastFailureAt: input.lastFailureAt,
      recentFailureRate: rate,
    };
  }
  return {
    health: 'HEALTHY',
    reasons: [],
    lastSuccessAt: input.lastSuccessAt,
    lastFailureAt: input.lastFailureAt,
    recentFailureRate: rate,
  };
}

function failureRate(successes: number, failures: number): number {
  const total = successes + failures;
  if (total === 0) return 0;
  return failures / total;
}

export const PROVIDER_HEALTH_LABELS: Readonly<Record<IntegrationHealth, string>> = Object.freeze({
  HEALTHY: 'Saludable',
  DEGRADED: 'Degradado',
  UNAVAILABLE: 'No disponible',
  DISABLED: 'Deshabilitado',
  UNKNOWN: 'Sin datos',
});

export const PROVIDER_CIRCUIT_STATE_LABELS: Readonly<Record<'CLOSED' | 'OPEN' | 'HALF_OPEN', string>> = Object.freeze({
  CLOSED: 'Cerrado',
  OPEN: 'Abierto',
  HALF_OPEN: 'Semi-abierto',
});

export function getIntegrationProviderLabel(provider: IntegrationProvider): string {
  // Avoid pulling the labels array from integration-types to keep this file pure.
  return provider;
}
