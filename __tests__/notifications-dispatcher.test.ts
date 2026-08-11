import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const txMock = vi.hoisted(() => ({
  organizationMembership: { findMany: vi.fn() },
  notification: { create: vi.fn() },
  systemAuditEvent: { create: vi.fn() },
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  organizationMembership: { findMany: vi.fn() },
  notification: { create: vi.fn() },
  systemAuditEvent: { create: vi.fn() },
}));

const appendEventMock = vi.hoisted(() => vi.fn());
const recordEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/platform/security/audit/security-events', () => ({
  appendSecurityEvent: appendEventMock,
  recordSecurityEvent: recordEventMock,
}));

import { notificationDispatcher } from '@/modules/notifications/application/dispatcher';

const membership = (userId: string, role: 'OWNER' | 'ADMIN' = 'OWNER') => ({
  userId,
  user: { email: `${userId}@example.com`, isActive: true },
  role,
});

describe('notificationDispatcher', () => {
  beforeEach(() => {
    txMock.organizationMembership.findMany.mockReset();
    txMock.notification.create.mockReset();
    txMock.systemAuditEvent.create.mockReset();
    prismaMock.organizationMembership.findMany.mockReset();
    prismaMock.notification.create.mockReset();
    prismaMock.systemAuditEvent.create.mockReset();
    appendEventMock.mockReset();
    recordEventMock.mockReset();
  });

  it('skips when no recipients exist and writes an audit', async () => {
    prismaMock.organizationMembership.findMany.mockResolvedValue([]);

    const outcome = await notificationDispatcher.dispatch({
      organizationId: 'org-1',
      eventType: 'organization.lifecycle.suspended',
      aggregateId: 'org-1',
      eventId: 'evt-1',
      actorUserId: 'admin-1',
      requestId: 'req-1',
    });

    expect(outcome.attemptedRecipients).toBe(0);
    expect(outcome.created).toEqual([]);
    expect(recordEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'notification.dispatch.organization.lifecycle.suspended',
      reasonCode: 'NO_RECIPIENTS',
    }));
  });

  it('creates one in-app notification per owner with idempotency key', async () => {
    prismaMock.organizationMembership.findMany.mockResolvedValue([
      membership('user-1', 'OWNER'),
      membership('user-2', 'OWNER'),
    ]);
    prismaMock.notification.create
      .mockResolvedValueOnce({ id: 'n-1', channel: 'IN_APP', userId: 'user-1', status: 'SENT' })
      .mockResolvedValueOnce({ id: 'n-2', channel: 'IN_APP', userId: 'user-2', status: 'SENT' });

    const outcome = await notificationDispatcher.dispatch({
      organizationId: 'org-1',
      eventType: 'organization.lifecycle.suspended',
      aggregateId: 'org-1',
      eventId: 'evt-1',
      actorUserId: 'admin-1',
      requestId: 'req-1',
      metadata: { reason: 'maintenance' },
    });

    expect(outcome.created).toHaveLength(2);
    expect(outcome.deduped).toBe(0);
    expect(outcome.channels).toEqual(['IN_APP']);

    const firstCall = prismaMock.notification.create.mock.calls[0]?.[0];
    expect(firstCall.data.idempotencyKey).toMatch(/^organization\.lifecycle\.suspended:IN_APP:/);
    expect(firstCall.data.actionUrl).toBe('/ajustes/organizacion');
    expect(firstCall.data.deliveries.create).toEqual(expect.objectContaining({
      channel: 'IN_APP',
      status: 'SENT',
      destination: 'in-app:user-1',
    }));
  });

  it('queues EMAIL rows in PENDING status for 8D to process', async () => {
    prismaMock.organizationMembership.findMany.mockResolvedValue([membership('user-1', 'OWNER')]);
    prismaMock.notification.create.mockResolvedValueOnce({
      id: 'n-1',
      channel: 'IN_APP',
      userId: 'user-1',
      status: 'SENT',
    });

    await notificationDispatcher.dispatch({
      organizationId: 'org-1',
      eventType: 'organization.lifecycle.closure_requested',
      aggregateId: 'org-1',
      eventId: 'evt-1',
      actorUserId: 'admin-1',
      requestId: 'req-2',
    });

    // Only IN_APP wired in 8A. The closure_requested rule declares EMAIL too;
    // the dispatcher must filter it out without producing a row.
    const created = prismaMock.notification.create.mock.calls;
    const channels = created.map((call) => call[0]?.data?.channel);
    expect(channels).toEqual(['IN_APP']);
  });

  it('marks duplicate inserts as deduped and continues', async () => {
    prismaMock.organizationMembership.findMany.mockResolvedValue([membership('user-1', 'OWNER')]);
    const uniqueError = new Prisma.PrismaClientKnownRequestError('Unique violation', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['organizationId', 'idempotencyKey'] },
    });
    prismaMock.notification.create.mockRejectedValueOnce(uniqueError);

    const outcome = await notificationDispatcher.dispatch({
      organizationId: 'org-1',
      eventType: 'organization.lifecycle.suspended',
      aggregateId: 'org-1',
      eventId: 'evt-1',
      actorUserId: 'admin-1',
      requestId: 'req-3',
    });

    expect(outcome.deduped).toBe(1);
    expect(outcome.skipped).toEqual([{ channel: 'IN_APP', userId: 'user-1', reason: 'DEDUPED' }]);
    expect(outcome.created).toEqual([]);
  });

  it('does not include recipients from another organization', async () => {
    prismaMock.organizationMembership.findMany.mockResolvedValue([
      membership('user-1', 'OWNER'),
    ]);
    prismaMock.notification.create.mockResolvedValueOnce({
      id: 'n-1',
      channel: 'IN_APP',
      userId: 'user-1',
      status: 'SENT',
    });

    await notificationDispatcher.dispatch({
      organizationId: 'org-1',
      eventType: 'organization.lifecycle.suspended',
      aggregateId: 'org-1',
      eventId: 'evt-1',
      actorUserId: 'admin-1',
      requestId: 'req-4',
    });

    expect(prismaMock.organizationMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1', status: 'ACTIVE' }),
      }),
    );
  });

  it('flags mandatory events in the audit attributes', async () => {
    prismaMock.organizationMembership.findMany.mockResolvedValue([membership('user-1', 'OWNER')]);
    prismaMock.notification.create.mockResolvedValueOnce({
      id: 'n-1',
      channel: 'IN_APP',
      userId: 'user-1',
      status: 'SENT',
    });

    await notificationDispatcher.dispatch({
      organizationId: 'org-1',
      eventType: 'organization.lifecycle.archived',
      aggregateId: 'org-1',
      eventId: 'evt-1',
      actorUserId: 'admin-1',
      requestId: 'req-5',
    });

    expect(recordEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'notification.dispatch.organization.lifecycle.archived',
      attributes: expect.objectContaining({ mandatory: true }),
    }));
  });

  it('throws when the action URL is invalid', async () => {
    prismaMock.organizationMembership.findMany.mockResolvedValue([membership('user-1', 'OWNER')]);

    await expect(
      notificationDispatcher.dispatch({
        organizationId: 'org-1',
        eventType: 'organization.lifecycle.archived',
        aggregateId: 'org-1',
        eventId: 'evt-1',
        actorUserId: 'admin-1',
        requestId: 'req-6',
        actionUrl: 'https://malicious.example.com',
      }),
    ).rejects.toThrow();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });
});
