import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type NotificationDbClient = PrismaClient | Prisma.TransactionClient;

function db(client?: NotificationDbClient): NotificationDbClient {
  return client ?? prisma;
}

export function createNotificationWithDelivery(
  client: NotificationDbClient | undefined,
  data: Prisma.NotificationUncheckedCreateInput,
) {
  return (db(client) as PrismaClient).notification.create({
    data,
    select: { id: true, channel: true, userId: true, status: true },
  });
}

export function findActiveMembershipRecipients(
  client: NotificationDbClient | undefined,
  where: Prisma.OrganizationMembershipWhereInput,
) {
  return db(client).organizationMembership.findMany({
    where,
    select: {
      userId: true,
      user: { select: { email: true, isActive: true } },
    },
  });
}

export function listNotificationsPage(
  client: NotificationDbClient | undefined,
  input: { where: Prisma.NotificationWhereInput; unreadWhere: Prisma.NotificationWhereInput; skip: number; take: number },
) {
  const c = db(client);
  return Promise.all([
    c.notification.findMany({
      where: input.where,
      orderBy: { createdAt: 'desc' },
      skip: input.skip,
      take: input.take,
    }),
    c.notification.count({ where: input.where }),
    c.notification.count({ where: input.unreadWhere }),
  ]);
}

export function countNotifications(client: NotificationDbClient | undefined, where: Prisma.NotificationWhereInput) {
  return db(client).notification.count({ where });
}

export function findNotification(client: NotificationDbClient | undefined, organizationId: string, id: string) {
  return db(client).notification.findFirst({
    where: { id, organizationId },
  });
}

export function markNotificationRead(client: NotificationDbClient | undefined, id: string) {
  return db(client).notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
}

export function markNotificationsRead(client: NotificationDbClient | undefined, where: Prisma.NotificationWhereInput) {
  return db(client).notification.updateMany({
    where,
    data: { readAt: new Date() },
  });
}

/**
 * Cliente para `appendSecurityEvent`, o `null` si no aplica. Conserva el criterio
 * histórico: se usa cuando el cliente expone `$transaction`.
 */
export function resolveSecurityEventClient(client: NotificationDbClient | undefined): Prisma.TransactionClient | null {
  const resolved = db(client);
  return typeof (resolved as { $transaction?: unknown }).$transaction === 'function'
    ? resolved as Prisma.TransactionClient
    : null;
}

export function isPrismaUniqueViolation(error: unknown, target: readonly string[]): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;
  const fields = Array.isArray(error.meta?.target) ? error.meta?.target as string[] : [];
  return target.every((field) => fields.includes(field));
}
