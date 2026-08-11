import { describe, expect, it } from 'vitest';
import { integrationRegistry } from '@/platform/integrations/application/registry';
import {
  INTEGRATION_PROVIDERS,
  isValidProviderCapability,
  PROVIDER_CAPABILITIES,
  PROVIDER_LABELS,
} from '@/platform/integrations/domain/integration-types';
import { computeHealth } from '@/platform/integrations/domain/connection-status';

describe('integrationRegistry', () => {
  it('lists every known provider with capabilities and labels', () => {
    const listed = integrationRegistry.list();
    expect(listed.length).toBe(INTEGRATION_PROVIDERS.length);
    for (const provider of INTEGRATION_PROVIDERS) {
      const meta = integrationRegistry.get(provider);
      expect(meta?.provider).toBe(provider);
      expect(meta?.label).toBe(PROVIDER_LABELS[provider]);
      expect(meta?.capabilities).toEqual(PROVIDER_CAPABILITIES[provider]);
    }
  });

  it('returns null for unknown providers', () => {
    expect(integrationRegistry.get('NOT_A_PROVIDER')).toBeNull();
  });

  it('throws when asserting a provider/capability mismatch', () => {
    expect(() => integrationRegistry.assertSupports('SMTP', 'IDENTITY_LOGIN')).toThrow();
    expect(() => integrationRegistry.assertSupports('MICROSOFT_ENTRA', 'IDENTITY_LOGIN')).not.toThrow();
  });
});

describe('isValidProviderCapability', () => {
  it('honors the static capability table', () => {
    expect(isValidProviderCapability('MICROSOFT_GRAPH', 'EMAIL_SEND')).toBe(true);
    expect(isValidProviderCapability('AWS_S3', 'EMAIL_SEND')).toBe(false);
  });
});

describe('computeHealth', () => {
  it('returns DISABLED for disabled status', () => {
    const result = computeHealth({
      status: 'DISABLED',
      circuitState: 'CLOSED',
      lastSuccessAt: new Date(),
      lastFailureAt: null,
      recentSuccesses: 5,
      recentFailures: 0,
    });
    expect(result.health).toBe('UNAVAILABLE');
    expect(result.reasons).toContain('integration_disabled');
  });

  it('returns UNKNOWN for DRAFT integrations', () => {
    const result = computeHealth({
      status: 'DRAFT',
      circuitState: 'CLOSED',
      lastSuccessAt: null,
      lastFailureAt: null,
      recentSuccesses: 0,
      recentFailures: 0,
    });
    expect(result.health).toBe('UNKNOWN');
  });

  it('returns HEALTHY when failure rate is low', () => {
    const result = computeHealth({
      status: 'ACTIVE',
      circuitState: 'CLOSED',
      lastSuccessAt: new Date(),
      lastFailureAt: null,
      recentSuccesses: 9,
      recentFailures: 1,
    });
    expect(result.health).toBe('HEALTHY');
  });

  it('returns DEGRADED when failure rate crosses the threshold', () => {
    const result = computeHealth({
      status: 'ACTIVE',
      circuitState: 'CLOSED',
      lastSuccessAt: new Date(),
      lastFailureAt: new Date(),
      recentSuccesses: 3,
      recentFailures: 2,
    });
    expect(result.health).toBe('DEGRADED');
  });

  it('returns UNAVAILABLE when failure rate crosses the high threshold', () => {
    const result = computeHealth({
      status: 'ACTIVE',
      circuitState: 'CLOSED',
      lastSuccessAt: new Date(),
      lastFailureAt: new Date(),
      recentSuccesses: 1,
      recentFailures: 4,
    });
    expect(result.health).toBe('UNAVAILABLE');
  });

  it('overrides health to UNAVAILABLE when circuit is OPEN', () => {
    const result = computeHealth({
      status: 'ACTIVE',
      circuitState: 'OPEN',
      lastSuccessAt: new Date(),
      lastFailureAt: null,
      recentSuccesses: 10,
      recentFailures: 0,
    });
    expect(result.health).toBe('UNAVAILABLE');
    expect(result.reasons).toContain('circuit_open');
  });
});
