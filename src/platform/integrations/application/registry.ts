import type { IntegrationCapability, IntegrationProvider, IntegrationStatus } from '../domain/integration-types';
import {
  getProviderTimeout,
  isValidProviderCapability,
  PROVIDER_CAPABILITIES,
  PROVIDER_LABELS,
} from '../domain/integration-types';

export type ProviderMetadata = Readonly<{
  provider: IntegrationProvider;
  label: string;
  capabilities: readonly IntegrationCapability[];
  defaultStatus: IntegrationStatus;
}>;

const REGISTRY = new Map<IntegrationProvider, ProviderMetadata>();

function buildMetadata(provider: IntegrationProvider): ProviderMetadata {
  return {
    provider,
    label: PROVIDER_LABELS[provider],
    capabilities: PROVIDER_CAPABILITIES[provider],
    defaultStatus: 'DRAFT',
  };
}

for (const provider of Object.keys(PROVIDER_CAPABILITIES) as IntegrationProvider[]) {
  REGISTRY.set(provider, buildMetadata(provider));
}

export const integrationRegistry = {
  list(): readonly ProviderMetadata[] {
    return Array.from(REGISTRY.values());
  },
  get(provider: string): ProviderMetadata | null {
    if (!REGISTRY.has(provider as IntegrationProvider)) return null;
    return REGISTRY.get(provider as IntegrationProvider) ?? null;
  },
  assertSupports(provider: string, capability: IntegrationCapability): ProviderMetadata {
    const meta = this.get(provider);
    if (!meta) {
      throw new Error(`Provider ${provider} is not registered.`);
    }
    if (!isValidProviderCapability(meta.provider, capability)) {
      throw new Error(`Provider ${meta.provider} does not declare capability ${capability}.`);
    }
    return meta;
  },
  resolveTimeout(provider: IntegrationProvider, operation: string, fallbackMs?: number): number {
    return getProviderTimeout(provider, operation, fallbackMs);
  },
};
