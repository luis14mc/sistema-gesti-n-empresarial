import type { IntegrationCapability, IntegrationStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordSecurityEvent } from '@/platform/security/audit/security-events';
import { createLogger } from '@/platform/observability/logger';
import {
  IntegrationConfigurationInvalidError,
  IntegrationNotFoundError,
  IntegrationPermissionDeniedError,
} from '../domain/integration-errors';
import type { IntegrationProvider } from '../domain/integration-types';
import { integrationRegistry } from './registry';
import { integrationExecutionService } from './execution-service';
import { secretService } from './secret-service';

export type CreateIntegrationInput = Readonly<{
  organizationId: string;
  provider: IntegrationProvider;
  name: string;
  capabilities: readonly IntegrationCapability[];
  publicConfig?: Prisma.InputJsonValue | null;
  secretPayload?: Record<string, string>;
  actorUserId: string;
  requestId: string;
}>;

export type UpdateIntegrationInput = Readonly<{
  organizationId: string;
  integrationId: string;
  name?: string;
  capabilities?: readonly IntegrationCapability[];
  publicConfig?: Prisma.InputJsonValue | null;
  status?: IntegrationStatus;
  actorUserId: string;
  requestId: string;
}>;

const MODULE = 'integrations';

function assertValidProvider(provider: string): IntegrationProvider {
  if (!integrationRegistry.get(provider)) {
    throw new IntegrationConfigurationInvalidError(provider as IntegrationProvider, 'Unknown provider.');
  }
  return provider as IntegrationProvider;
}

function assertValidCapabilities(provider: IntegrationProvider, capabilities: readonly IntegrationCapability[]): void {
  for (const capability of capabilities) {
    if (!integrationRegistry.get(provider)) continue;
    integrationRegistry.assertSupports(provider, capability);
  }
}

export const integrationConnectionService = {
  async create(input: CreateIntegrationInput) {
    const log = createLogger({
      requestId: input.requestId,
      organizationId: input.organizationId,
      module: MODULE,
    });
    const provider = assertValidProvider(input.provider);
    if (!input.name?.trim()) {
      throw new IntegrationConfigurationInvalidError(provider, 'Integration name is required.');
    }
    assertValidCapabilities(provider, input.capabilities);

    const integration = await prisma.$transaction(async (tx) => {
      const created = await tx.organizationIntegration.create({
        data: {
          organizationId: input.organizationId,
          provider,
          name: input.name.trim(),
          capabilities: [...input.capabilities],
          publicConfig: input.publicConfig ?? undefined,
          status: 'DRAFT',
          createdById: input.actorUserId,
        },
      });
      return created;
    });

    if (input.secretPayload && Object.keys(input.secretPayload).length > 0) {
      await secretService.storeForIntegration({
        organizationId: input.organizationId,
        integrationId: integration.id,
        actorUserId: input.actorUserId,
        requestId: input.requestId,
        payload: input.secretPayload,
      });
      await prisma.organizationIntegration.update({
        where: { id: integration.id },
        data: { secretReference: secretService.buildReference(input.organizationId, integration.id) },
      });
    }

    await recordSecurityEvent({
      organizationId: input.organizationId,
      userId: input.actorUserId,
      eventType: 'integration.created',
      outcome: 'SUCCESS',
      severity: 'INFO',
      module: MODULE,
      entityType: 'OrganizationIntegration',
      entityId: integration.id,
      action: 'CREATE',
      requestId: input.requestId,
      attributes: {
        provider,
        capabilities: input.capabilities,
        storedSecret: Boolean(input.secretPayload && Object.keys(input.secretPayload).length > 0),
      },
    });

    log.info('integration.created', { integrationId: integration.id, provider });
    return integration;
  },

  async update(input: UpdateIntegrationInput) {
    const log = createLogger({
      requestId: input.requestId,
      organizationId: input.organizationId,
      module: MODULE,
    });
    const existing = await prisma.organizationIntegration.findFirst({
      where: { id: input.integrationId, organizationId: input.organizationId },
    });
    if (!existing) {
      throw new IntegrationNotFoundError(input.integrationId, input.organizationId);
    }
    if (input.capabilities) {
      assertValidCapabilities(existing.provider as IntegrationProvider, input.capabilities);
    }
    const updated = await prisma.organizationIntegration.update({
      where: { id: input.integrationId },
      data: {
        name: input.name?.trim() ?? existing.name,
        capabilities: input.capabilities ? [...input.capabilities] : existing.capabilities,
        publicConfig: input.publicConfig === undefined
          ? (existing.publicConfig as Prisma.InputJsonValue | null) ?? Prisma.JsonNull
          : input.publicConfig ?? Prisma.JsonNull,
        status: input.status ?? existing.status,
        updatedById: input.actorUserId,
      },
    });
    await recordSecurityEvent({
      organizationId: input.organizationId,
      userId: input.actorUserId,
      eventType: 'integration.updated',
      outcome: 'SUCCESS',
      severity: 'INFO',
      module: MODULE,
      entityType: 'OrganizationIntegration',
      entityId: input.integrationId,
      action: 'UPDATE',
      requestId: input.requestId,
      attributes: {
        status: input.status,
        capabilitiesChanged: Boolean(input.capabilities),
      },
    });
    log.info('integration.updated', { integrationId: input.integrationId });
    return updated;
  },

  async setStatus(input: {
    organizationId: string;
    integrationId: string;
    status: IntegrationStatus;
    actorUserId: string;
    requestId: string;
  }) {
    const updated = await prisma.organizationIntegration.update({
      where: { id: input.integrationId },
      data: {
        status: input.status,
        updatedById: input.actorUserId,
      },
    });
    const eventType = input.status === 'ACTIVE'
      ? 'integration.enabled'
      : input.status === 'DISABLED'
        ? 'integration.disabled'
        : 'integration.status_changed';
    await recordSecurityEvent({
      organizationId: input.organizationId,
      userId: input.actorUserId,
      eventType,
      outcome: 'SUCCESS',
      severity: input.status === 'DISABLED' ? 'WARNING' : 'INFO',
      module: MODULE,
      entityType: 'OrganizationIntegration',
      entityId: input.integrationId,
      action: 'SET_STATUS',
      requestId: input.requestId,
      attributes: { status: input.status },
    });
    return updated;
  },

  async rotateCredentials(input: {
    organizationId: string;
    integrationId: string;
    secretPayload: Record<string, string>;
    actorUserId: string;
    requestId: string;
  }) {
    const existing = await prisma.organizationIntegration.findFirst({
      where: { id: input.integrationId, organizationId: input.organizationId },
    });
    if (!existing) {
      throw new IntegrationNotFoundError(input.integrationId, input.organizationId);
    }
    if (!input.actorUserId) {
      throw new IntegrationPermissionDeniedError();
    }
    await secretService.storeForIntegration({
      organizationId: input.organizationId,
      integrationId: input.integrationId,
      actorUserId: input.actorUserId,
      requestId: input.requestId,
      payload: input.secretPayload,
    });
    const updated = await prisma.organizationIntegration.update({
      where: { id: input.integrationId },
      data: {
        secretReference: secretService.buildReference(input.organizationId, input.integrationId),
        updatedById: input.actorUserId,
        lastSuccessfulAt: new Date(),
      },
    });
    await recordSecurityEvent({
      organizationId: input.organizationId,
      userId: input.actorUserId,
      eventType: 'integration.credentials.rotated',
      outcome: 'SUCCESS',
      severity: 'WARNING',
      module: MODULE,
      entityType: 'OrganizationIntegration',
      entityId: input.integrationId,
      action: 'ROTATE_CREDENTIALS',
      requestId: input.requestId,
      attributes: { keys: Object.keys(input.secretPayload).map((k) => k.length) },
    });
    return updated;
  },

  async testConnection(input: {
    organizationId: string;
    integrationId: string;
    actorUserId: string;
    requestId: string;
    operation?: (parameters: { signal: AbortSignal; provider: IntegrationProvider; secret: Record<string, string> }) => Promise<{ ok: boolean; errorCode?: string; errorMessage?: string }>;
  }) {
    const startedAt = Date.now();
    const integration = await prisma.organizationIntegration.findFirst({
      where: { id: input.integrationId, organizationId: input.organizationId },
    });
    if (!integration) {
      throw new IntegrationNotFoundError(input.integrationId, input.organizationId);
    }
    const secret = integration.secretReference
      ? await secretService.readForIntegration({
          organizationId: input.organizationId,
          integrationId: input.integrationId,
          actorUserId: input.actorUserId,
          requestId: input.requestId,
        })
      : {};
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    let success = false;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    try {
      if (!input.operation) {
        success = true;
      } else {
        const result = await input.operation({
          signal: controller.signal,
          provider: integration.provider as IntegrationProvider,
          secret,
        });
        success = result.ok;
        errorCode = result.errorCode;
        errorMessage = result.errorMessage;
      }
    } catch (error) {
      success = false;
      errorCode = error instanceof Error ? error.name : 'TEST_FAILED';
      errorMessage = error instanceof Error ? error.message : 'Connection test failed.';
    } finally {
      clearTimeout(timeout);
    }
    const durationMs = Date.now() - startedAt;
    return integrationExecutionService.recordConnectionTest({
      organizationId: input.organizationId,
      integrationId: input.integrationId,
      success,
      durationMs,
      errorCode,
      errorMessage,
      actorUserId: input.actorUserId,
      requestId: input.requestId,
    });
  },
};
