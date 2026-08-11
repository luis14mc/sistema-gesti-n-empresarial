import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = vi.hoisted(() => ({
  organizationIntegration: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  integrationExecution: {
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  organizationIntegration: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  integrationExecution: {
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
}));

const recordEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/platform/security/audit/security-events', () => ({
  recordSecurityEvent: recordEventMock,
}));

import { integrationExecutionService } from '@/platform/integrations/application/execution-service';
import { IntegrationNotFoundError } from '@/platform/integrations/domain/integration-errors';

const txClient = txMock as unknown as import('@prisma/client').Prisma.TransactionClient;

describe('integrationExecutionService', () => {
  beforeEach(() => {
    txMock.organizationIntegration.findFirst.mockReset();
    txMock.organizationIntegration.update.mockReset();
    txMock.integrationExecution.create.mockReset();
    txMock.integrationExecution.update.mockReset();
    txMock.integrationExecution.count.mockReset();
    prismaMock.organizationIntegration.findFirst.mockReset();
    prismaMock.organizationIntegration.update.mockReset();
    prismaMock.integrationExecution.create.mockReset();
    prismaMock.integrationExecution.update.mockReset();
    prismaMock.integrationExecution.count.mockReset();
    recordEventMock.mockReset();
  });

  it('rejects start when the integration does not belong to the organization', async () => {
    txMock.organizationIntegration.findFirst.mockResolvedValueOnce(null);
    await expect(
      integrationExecutionService.start({
        organizationId: 'org-1',
        integrationId: 'int-1',
        operation: 'email.send',
        requestId: 'req-1',
      }, txClient),
    ).rejects.toBeInstanceOf(IntegrationNotFoundError);
  });

  it('records a STARTED execution row when starting', async () => {
    const integration = { id: 'int-1', organizationId: 'org-1', provider: 'SMTP', name: 'smtp-primary' };
    txMock.organizationIntegration.findFirst.mockResolvedValueOnce(integration);
    txMock.integrationExecution.create.mockResolvedValueOnce({
      id: 'exec-1',
      operation: 'email.send',
      status: 'STARTED',
      attempt: 1,
    });

    const { execution } = await integrationExecutionService.start({
      organizationId: 'org-1',
      integrationId: 'int-1',
      operation: 'email.send',
      requestId: 'req-2',
    }, txClient);

    expect(execution.id).toBe('exec-1');
    expect(txMock.integrationExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'STARTED' }) }),
    );
  });

  it('records a connection test result and updates the integration health fields', async () => {
    prismaMock.organizationIntegration.findFirst.mockResolvedValueOnce({
      id: 'int-1',
      organizationId: 'org-1',
      provider: 'SMTP',
      name: 'smtp',
      status: 'DRAFT',
      lastSuccessfulAt: null,
      lastFailureAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    prismaMock.integrationExecution.create.mockResolvedValueOnce({ id: 'exec-1' });
    prismaMock.organizationIntegration.update.mockResolvedValueOnce({
      id: 'int-1',
      organizationId: 'org-1',
      provider: 'SMTP',
      name: 'smtp',
      status: 'ACTIVE',
      lastSuccessfulAt: new Date(),
      lastFailureAt: null,
    });
    prismaMock.integrationExecution.count.mockResolvedValue(1);

    const result = await integrationExecutionService.recordConnectionTest({
      organizationId: 'org-1',
      integrationId: 'int-1',
      success: true,
      durationMs: 120,
      actorUserId: 'admin-1',
      requestId: 'req-3',
    }, prismaMock as unknown as typeof import('@/lib/prisma').prisma);

    expect(result.success).toBe(true);
    expect(recordEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'integration.connection.tested',
      outcome: 'SUCCESS',
    }));
  });
});
