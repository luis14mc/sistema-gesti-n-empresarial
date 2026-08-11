import { prisma } from '@/lib/prisma';
import { createLogger } from '@/platform/observability/logger';
import { recordSecurityEvent } from '@/platform/security/audit/security-events';
import { IntegrationSecretReferenceError } from '../domain/integration-errors';
import { inMemorySecretStore, resetInMemorySecretStore } from '../infrastructure/secrets/in-memory-store';
import { isSecretKey, normalizeSecretReference, type SecretStore, type SecretValue } from '../infrastructure/secrets/types';

let activeStore: SecretStore = inMemorySecretStore;

export function setSecretStore(store: SecretStore): void {
  activeStore = store;
}

export function getSecretStore(): SecretStore {
  return activeStore;
}

export type StoreSecretInput = Readonly<{
  organizationId: string;
  integrationId: string;
  payload: SecretValue;
  actorUserId: string;
  requestId: string;
}>;

export type StoreSecretResult = Readonly<{
  reference: string;
  storedAt: Date;
}>;

function buildReference(organizationId: string, integrationId: string): string {
  if (!isSecretKey(organizationId) || !isSecretKey(integrationId)) {
    throw new IntegrationSecretReferenceError('Organization or integration identifier is not a valid secret key.');
  }
  return `secret:prod:org-${organizationId}-int-${integrationId}`;
}

export const secretService = {
  async storeForIntegration(input: StoreSecretInput): Promise<StoreSecretResult> {
    const reference = buildReference(input.organizationId, input.integrationId);
    const store = getSecretStore();
    await store.rotate(reference, input.payload);
    await recordSecurityEvent({
      organizationId: input.organizationId,
      userId: input.actorUserId,
      eventType: 'integration.secret.stored',
      outcome: 'SUCCESS',
      severity: 'INFO',
      module: 'integrations',
      entityType: 'OrganizationIntegration',
      entityId: input.integrationId,
      action: 'STORE_SECRET',
      requestId: input.requestId,
      attributes: {
        reference,
        keys: Object.keys(input.payload).map((key) => key.length > 0 ? `${key.length}` : '0'),
      },
    });
    return { reference, storedAt: new Date() };
  },

  async readForIntegration(input: {
    organizationId: string;
    integrationId: string;
    actorUserId: string;
    requestId: string;
  }): Promise<SecretValue> {
    const reference = buildReference(input.organizationId, input.integrationId);
    const store = getSecretStore();
    const value = await store.read(reference);
    await recordSecurityEvent({
      organizationId: input.organizationId,
      userId: input.actorUserId,
      eventType: 'integration.secret.read',
      outcome: 'SUCCESS',
      severity: 'INFO',
      module: 'integrations',
      entityType: 'OrganizationIntegration',
      entityId: input.integrationId,
      action: 'READ_SECRET',
      requestId: input.requestId,
      attributes: { reference },
    });
    return value;
  },

  async deleteForIntegration(input: {
    organizationId: string;
    integrationId: string;
    actorUserId: string;
    requestId: string;
  }): Promise<void> {
    const reference = buildReference(input.organizationId, input.integrationId);
    const store = getSecretStore();
    await store.delete(reference);
    await recordSecurityEvent({
      organizationId: input.organizationId,
      userId: input.actorUserId,
      eventType: 'integration.secret.deleted',
      outcome: 'SUCCESS',
      severity: 'WARNING',
      module: 'integrations',
      entityType: 'OrganizationIntegration',
      entityId: input.integrationId,
      action: 'DELETE_SECRET',
      requestId: input.requestId,
      attributes: { reference },
    });
  },

  async listReferences(prefix: string): Promise<readonly string[]> {
    return getSecretStore().listReferences(prefix);
  },

  buildReference,
  normalizeReference: normalizeSecretReference,
  reset: resetInMemorySecretStore,
};

export function logSecretRedactionWarning(context: { requestId: string; organizationId?: string; integrationId?: string; reason: string }): void {
  createLogger({
    requestId: context.requestId,
    organizationId: context.organizationId,
    module: 'integrations',
  }).warn('integration.secret.redaction', {
    integrationId: context.integrationId,
    reason: context.reason,
  });
  void prisma;
}
