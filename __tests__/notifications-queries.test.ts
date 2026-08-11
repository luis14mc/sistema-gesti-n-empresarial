import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  notification: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));

const recordEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/platform/security/audit/security-events', () => ({
  recordSecurityEvent: recordEventMock,
}));

import { notificationQueryService, notificationCommandService } from '@/modules/notifications/application/queries';
import { NotificationNotFoundError, NotificationOwnershipError } from '@/modules/notifications/domain/errors';

describe('notificationQueryService', () => {
  beforeEach(() => {
    prismaMock.notification.findMany.mockReset();
    prismaMock.notification.count.mockReset();
  });

  it('lists only notifications for the current user and organization', async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);

    await notificationQueryService.list({
      organizationId: 'org-1',
      userId: 'user-1',
      page: 1,
      pageSize: 20,
    });

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          OR: [{ userId: 'user-1' }, { userId: null }],
        }),
      }),
    );
  });

  it('returns the user-scoped unread count', async () => {
    prismaMock.notification.count.mockResolvedValue(5);
    const count = await notificationQueryService.unreadCount('org-1', 'user-1');
    expect(count).toBe(5);
    expect(prismaMock.notification.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          OR: [{ userId: 'user-1' }, { userId: null }],
          readAt: null,
        }),
      }),
    );
  });
});

describe('notificationCommandService.markRead', () => {
  beforeEach(() => {
    prismaMock.notification.findFirst.mockReset();
    prismaMock.notification.update.mockReset();
    prismaMock.notification.updateMany.mockReset();
    recordEventMock.mockReset();
  });

  it('refuses to mark a notification that does not belong to the current organization', async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);
    await expect(
      notificationCommandService.markRead({
        organizationId: 'org-2',
        userId: 'user-1',
        notificationId: 'n-1',
        requestId: 'req-1',
      }),
    ).rejects.toBeInstanceOf(NotificationNotFoundError);
  });

  it('refuses to mark a notification owned by another user', async () => {
    prismaMock.notification.findFirst.mockResolvedValue({
      id: 'n-1',
      organizationId: 'org-1',
      userId: 'user-2',
      eventType: 'organization.lifecycle.suspended',
      channel: 'IN_APP',
      readAt: null,
    });
    await expect(
      notificationCommandService.markRead({
        organizationId: 'org-1',
        userId: 'user-1',
        notificationId: 'n-1',
        requestId: 'req-2',
      }),
    ).rejects.toBeInstanceOf(NotificationOwnershipError);
  });

  it('marks the notification as read and writes an audit', async () => {
    prismaMock.notification.findFirst.mockResolvedValue({
      id: 'n-1',
      organizationId: 'org-1',
      userId: 'user-1',
      eventType: 'organization.lifecycle.suspended',
      channel: 'IN_APP',
      readAt: null,
    });
    prismaMock.notification.update.mockResolvedValue({
      id: 'n-1',
      organizationId: 'org-1',
      userId: 'user-1',
      eventType: 'organization.lifecycle.suspended',
      channel: 'IN_APP',
      readAt: new Date(),
    });

    await notificationCommandService.markRead({
      organizationId: 'org-1',
      userId: 'user-1',
      notificationId: 'n-1',
      requestId: 'req-3',
    });

    expect(recordEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'notification.read',
      outcome: 'SUCCESS',
    }));
  });

  it('updates only the current user and current organization on read-all', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 4 });
    await notificationCommandService.markAllRead({
      organizationId: 'org-1',
      userId: 'user-1',
      requestId: 'req-4',
    });
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          OR: [{ userId: 'user-1' }, { userId: null }],
          readAt: null,
        }),
      }),
    );
  });
});
