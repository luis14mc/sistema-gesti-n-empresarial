import type { IntegrationExecutionStatus, OrganizationIntegration, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/platform/observability/logger';
import { recordSecurityEvent } from '@/platform/security/audit/security-events';
import {
  IntegrationNotFoundError,
} from '../domain/integration-errors';
import { computeHealth, type HealthComputation } from '../domain/connection-status';
import type { IntegrationProvider } from '../domain/integration-types';
import { integrationCircuitBreakers } from './circuit-breaker';

export type StartExecutionInput = Readonly<{
  organizationId: string;
  integrationId: string;
  operation: string;
  entityType?: string;
  entityId?: string;
  requestId: string;
  correlationId?: string;
  attempt?: number;
}>;

export type CompleteExecutionInput = Readonly<{
  executionId: string;
  status: IntegrationExecutionStatus;
  durationMs: number;
  providerStatusCode?: number;
  errorCode?: string;
  errorMessage?: string;
}>;

export type ConnectionTestResult = Readonly<{
  health: HealthComputation;
  executedAt: Date;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}>;

const INTEGRATION_AUDIT_MODULE = 'integrations';

export const integrationExecutionService = {
  async start(input: StartExecutionInput, client: Prisma.TransactionClient | typeof prisma = prisma) {
    const log = createLogger({
      requestId: input.requestId,
      organizationId: input.organizationId,
      module: INTEGRATION_AUDIT_MODULE,
    });
    const integration = await client.organizationIntegration.findFirst({
      where: { id: input.integrationId, organizationId: input.organizationId },
    });
    if (!integration) {
      throw new IntegrationNotFoundError(input.integrationId, input.organizationId);
    }
    const execution = await client.integrationExecution.create({
      data: {
        organizationId: input.organizationId,
        integrationId: input.integrationId,
        operation: input.operation,
        status: 'STARTED',
        entityType: input.entityType,
        entityId: input.entityId,
        requestId: input.requestId,
        correlationId: input.correlationId,
        attempt: input.attempt ?? 1,
        startedAt: new Date(),
      },
    });
    log.info('integration.execution.started', {
      executionId: execution.id,
      operation: input.operation,
      integrationId: input.integrationId,
      attempt: execution.attempt,
    });
    return { execution, integration };
  },

  async complete(input: CompleteExecutionInput, client: Prisma.TransactionClient | typeof prisma = prisma) {
    const log = createLogger({
      module: INTEGRATION_AUDIT_MODULE,
    });
    const execution = await client.integrationExecution.update({
      where: { id: input.executionId },
      data: {
        status: input.status,
        durationMs: input.durationMs,
        providerStatusCode: input.providerStatusCode,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        completedAt: new Date(),
      },
      include: { integration: true },
    });
    log.info('integration.execution.completed', {
      executionId: execution.id,
      status: execution.status,
      operation: execution.operation,
      durationMs: execution.durationMs,
      integrationId: execution.integrationId,
    });
    await this.refreshHealthSnapshot(execution.integration);
    return execution;
  },

  async recordConnectionTest(input: {
    organizationId: string;
    integrationId: string;
    success: boolean;
    durationMs: number;
    errorCode?: string;
    errorMessage?: string;
    requestId: string;
    actorUserId: string;
  }, client: Prisma.TransactionClient | typeof prisma = prisma): Promise<ConnectionTestResult> {
    const integration = await client.organizationIntegration.findFirst({
      where: { id: input.integrationId, organizationId: input.organizationId },
    });
    if (!integration) {
      throw new IntegrationNotFoundError(input.integrationId, input.organizationId);
    }
    const status: IntegrationExecutionStatus = input.success ? 'SUCCESS' : 'TRANSIENT_FAILURE';
    const execution = await client.integrationExecution.create({
      data: {
        organizationId: input.organizationId,
        integrationId: input.integrationId,
        operation: 'connection.test',
        status,
        attempt: 1,
        durationMs: input.durationMs,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
    const updatedIntegration = await client.organizationIntegration.update({
      where: { id: input.integrationId },
      data: {
        lastTestedAt: new Date(),
        lastSuccessfulAt: input.success ? new Date() : integration.lastSuccessfulAt,
        lastFailureAt: input.success ? integration.lastFailureAt : new Date(),
        lastErrorCode: input.success ? null : input.errorCode ?? integration.lastErrorCode,
        lastErrorMessage: input.success ? null : input.errorMessage ?? integration.lastErrorMessage,
        status: input.success && integration.status === 'DRAFT' ? 'ACTIVE' : integration.status,
      },
    });
    await recordSecurityEvent({
      organizationId: input.organizationId,
      userId: input.actorUserId,
      eventType: 'integration.connection.tested',
      outcome: input.success ? 'SUCCESS' : 'FAILURE',
      severity: input.success ? 'INFO' : 'WARNING',
      module: INTEGRATION_AUDIT_MODULE,
      entityType: 'OrganizationIntegration',
      entityId: input.integrationId,
      action: 'TEST_CONNECTION',
      requestId: input.requestId,
      attributes: {
        executionId: execution.id,
        durationMs: input.durationMs,
        errorCode: input.errorCode,
      },
    });
    return {
      health: await this.computeIntegrationHealth(updatedIntegration),
      executedAt: new Date(),
      success: input.success,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    };
  },

  async listRecentExecutions(input: {
    organizationId: string;
    integrationId: string;
    page: number;
    pageSize: number;
    status?: IntegrationExecutionStatus;
  }, client: Prisma.TransactionClient | typeof prisma = prisma) {
    const page = Number.isSafeInteger(input.page) && input.page > 0 ? input.page : 1;
    const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100);
    const where: Prisma.IntegrationExecutionWhereInput = {
      organizationId: input.organizationId,
      integrationId: input.integrationId,
      ...(input.status ? { status: input.status } : {}),
    };
    const [items, total] = await Promise.all([
      client.integrationExecution.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          operation: true,
          status: true,
          attempt: true,
          durationMs: true,
          providerStatusCode: true,
          errorCode: true,
          errorMessage: true,
          entityType: true,
          entityId: true,
          requestId: true,
          correlationId: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      client.integrationExecution.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  },

  async computeIntegrationHealth(integration: OrganizationIntegration, now: Date = new Date()): Promise<HealthComputation> {
    const breaker = integrationCircuitBreakers.for(`${integration.provider}:${integration.id}`);
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [successes, failures] = await Promise.all([
      prisma.integrationExecution.count({
        where: {
          organizationId: integration.organizationId,
          integrationId: integration.id,
          status: 'SUCCESS',
          startedAt: { gte: since },
        },
      }),
      prisma.integrationExecution.count({
        where: {
          organizationId: integration.organizationId,
          integrationId: integration.id,
          status: { in: ['TRANSIENT_FAILURE', 'PERMANENT_FAILURE', 'CIRCUIT_OPEN'] },
          startedAt: { gte: since },
        },
      }),
    ]);
    return computeHealth({
      status: integration.status,
      circuitState: breaker.snapshot(now).state,
      lastSuccessAt: integration.lastSuccessfulAt,
      lastFailureAt: integration.lastFailureAt,
      recentSuccesses: successes,
      recentFailures: failures,
    });
  },

  async refreshHealthSnapshot(integration: OrganizationIntegration): Promise<void> {
    await this.computeIntegrationHealth(integration);
  },
};

export function buildProviderKey(provider: IntegrationProvider, integrationId: string): string {
  return `${provider}:${integrationId}`;
}
