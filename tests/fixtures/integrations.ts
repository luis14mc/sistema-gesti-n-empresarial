import type { IntegrationCapability, IntegrationStatus } from '@prisma/client';
import type { IntegrationProvider } from '@/platform/integrations/domain/integration-types';

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}

export function resetIntegrationFactoryCounters(): void {
  counter = 0;
}

export type TestOrganizationIntegration = Readonly<{
  id: string;
  organizationId: string;
  provider: IntegrationProvider;
  name: string;
  status: IntegrationStatus;
  capabilities: readonly IntegrationCapability[];
  publicConfig: Record<string, unknown> | null;
  secretReference: string | null;
  lastTestedAt: Date | null;
  lastSuccessfulAt: Date | null;
  lastFailureAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdById: string;
}>;

export function seedOrganizationIntegration(overrides: Partial<TestOrganizationIntegration> & {
  organizationId: string;
  createdById: string;
}): TestOrganizationIntegration {
  const id = overrides.id ?? nextId('int');
  return {
    id,
    organizationId: overrides.organizationId,
    provider: overrides.provider ?? 'SMTP',
    name: overrides.name ?? `Integration ${id}`,
    status: overrides.status ?? 'DRAFT',
    capabilities: overrides.capabilities ?? ['EMAIL_SEND'],
    publicConfig: overrides.publicConfig ?? null,
    secretReference: overrides.secretReference ?? `secret:prod:org-${overrides.organizationId}-int-${id}`,
    lastTestedAt: overrides.lastTestedAt ?? null,
    lastSuccessfulAt: overrides.lastSuccessfulAt ?? null,
    lastFailureAt: overrides.lastFailureAt ?? null,
    lastErrorCode: overrides.lastErrorCode ?? null,
    lastErrorMessage: overrides.lastErrorMessage ?? null,
    createdById: overrides.createdById,
  };
}
