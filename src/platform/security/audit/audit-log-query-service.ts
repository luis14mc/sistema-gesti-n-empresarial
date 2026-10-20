import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { OrganizationContext } from '@/modules/organizations/application/context';
import {
  canForOrganization,
  requireOrganizationPermission,
} from '@/platform/security/authorization/effective-permissions';
import { maskEmailAddress, redactEmailsInJson, redactEmailsInText } from './email-redaction';

export type AuditLogQuery = Readonly<{
  userId?: string;
  module?: string;
  action?: string;
  page: number;
  pageSize: number;
}>;

type AuditLogRow = {
  id: string;
  title: string;
  description: string;
  module: string;
  category: string;
  priority: string;
  status: string;
  entityId: string | null;
  entityType: string | null;
  action: string | null;
  requestId: string | null;
  createdAt: Date;
  previousData: Prisma.JsonValue | null;
  newData: Prisma.JsonValue | null;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
};

function redactAuditLogRow(row: AuditLogRow, canReadUserEmails: boolean): Omit<AuditLogRow, 'previousData' | 'newData'> & {
  previousData: Prisma.JsonValue | null;
  newData: Prisma.JsonValue | null;
} {
  if (canReadUserEmails) return row;
  return {
    ...row,
    description: redactEmailsInText(row.description),
    previousData: row.previousData == null ? null : redactEmailsInJson(row.previousData) as Prisma.JsonValue,
    newData: row.newData == null ? null : redactEmailsInJson(row.newData) as Prisma.JsonValue,
    user: row.user
      ? { ...row.user, email: maskEmailAddress(row.user.email) }
      : null,
  };
}

export class AuditLogQueryService {
  async list(context: OrganizationContext, query: AuditLogQuery) {
    await requireOrganizationPermission(context.userId, context.organizationId, context.role, 'audit.read');
    const canReadUserEmails = await canForOrganization(
      context.userId,
      context.organizationId,
      context.role,
      'users.read',
    );

    const page = Number.isSafeInteger(query.page) && query.page > 0 ? query.page : 1;
    const pageSize = Number.isSafeInteger(query.pageSize)
      ? Math.min(Math.max(query.pageSize, 1), 100)
      : 20;
    const where: Prisma.AuditRecordWhereInput = {
      organizationId: context.organizationId,
      userId: query.userId || undefined,
      module: query.module || undefined,
      category: query.action || undefined,
    };

    const [logs, total] = await Promise.all([
      prisma.auditRecord.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          module: true,
          category: true,
          priority: true,
          status: true,
          entityId: true,
          entityType: true,
          action: true,
          requestId: true,
          createdAt: true,
          previousData: true,
          newData: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditRecord.count({ where }),
    ]);

    const redactedLogs = logs.map((log) => redactAuditLogRow(log as AuditLogRow, canReadUserEmails));

    return { logs: redactedLogs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}

export const auditLogQueryService = new AuditLogQueryService();
