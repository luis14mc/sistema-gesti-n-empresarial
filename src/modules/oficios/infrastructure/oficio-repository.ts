import type { Prisma } from '@prisma/client';
import { oficiosDb } from '@/modules/oficios/infrastructure/prisma-client';
import {
  oficioScope,
  oficioTenantScope,
  oficioUserAccessScope,
} from '@/modules/oficios/infrastructure/tenant-scope';

export async function searchOficios(params: {
  organizationId: string;
  userRole: string;
  userId: string;
  userEmail: string;
  filters: {
    q?: string;
    scope?: string;
    status?: string;
    recordSource?: string;
    type?: string;
    hasDocument?: string | null;
    yearParam?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    page: number;
    pageSize: number;
  };
}) {
  const { organizationId, userRole, userId, userEmail, filters } = params;
  const skip = (filters.page - 1) * filters.pageSize;

  const where: Prisma.OficioWhereInput = oficioTenantScope(organizationId);
  const andConditions: Prisma.OficioWhereInput[] = [];

  if (userRole === 'USER') {
    andConditions.push(oficioUserAccessScope(userId, userEmail));
  }

  if (filters.scope) where.scope = filters.scope;
  if (filters.status) where.status = filters.status as Prisma.EnumOficioStatusFilter;
  if (filters.recordSource) {
    where.recordSource = filters.recordSource as Prisma.EnumOficioRecordSourceFilter;
  }
  if (filters.type) where.type = filters.type as Prisma.EnumOficioTypeFilter;

  if (filters.yearParam && /^\d{4}$/.test(filters.yearParam)) {
    const y = parseInt(filters.yearParam, 10);
    where.oficioDate = {
      gte: new Date(`${y}-01-01`),
      lt: new Date(`${y + 1}-01-01`),
    };
  }
  if (filters.dateFrom || filters.dateTo) {
    const range: { gte?: Date; lt?: Date } = {};
    if (filters.dateFrom) range.gte = new Date(filters.dateFrom);
    if (filters.dateTo) {
      const d = new Date(filters.dateTo);
      d.setDate(d.getDate() + 1);
      range.lt = d;
    }
    where.oficioDate = { ...(where.oficioDate as object), ...range };
  }

  if (filters.hasDocument === 'true') where.documents = { some: {} };
  if (filters.hasDocument === 'false') where.documents = { none: {} };

  const q = filters.q;
  if (q) {
    andConditions.push({
      OR: [
        { number: { contains: q, mode: 'insensitive' } },
        { systemNumber: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { recipient: { contains: q, mode: 'insensitive' } },
        { institution: { contains: q, mode: 'insensitive' } },
        { preparedBy: { contains: q, mode: 'insensitive' } },
        { comments: { contains: q, mode: 'insensitive' } },
        { documents: { some: { originalName: { contains: q, mode: 'insensitive' } } } },
      ],
    });
  }
  if (andConditions.length > 0) where.AND = andConditions;

  const [oficios, total] = await Promise.all([
    oficiosDb.oficio.findMany({
      where,
      skip,
      take: filters.pageSize,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        documents: {
          select: { id: true, url: true, originalName: true, mimeType: true, isPrimary: true },
          orderBy: [{ isPrimary: 'desc' }, { uploadedAt: 'desc' }],
        },
      },
      orderBy: [{ oficioDate: 'desc' }, { createdAt: 'desc' }],
    }),
    oficiosDb.oficio.count({ where }),
  ]);

  return {
    oficios,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.ceil(total / filters.pageSize),
  };
}

export async function findOficioStatusContext(organizationId: string, id: string) {
  return oficiosDb.oficio.findFirst({
    where: oficioScope(organizationId, id),
    select: { id: true, status: true, number: true, createdById: true },
  });
}

export async function changeOficioStatus(params: {
  organizationId: string;
  oficioId: string;
  actorUserId: string;
  nextStatus: string;
  currentStatus: string;
}) {
  const { organizationId, oficioId, actorUserId, nextStatus, currentStatus } = params;
  const next = nextStatus;

  return oficiosDb.$transaction(async (tx) => {
    await tx.oficio.updateMany({
      where: oficioScope(organizationId, oficioId),
      data: {
        status: nextStatus as Prisma.EnumOficioStatusFieldUpdateOperationsInput['set'],
        updatedById: actorUserId,
        ...(next === 'SENT' || next === 'SIGNED' ? { sentDate: new Date() } : {}),
        ...(next === 'RECEIVED' ? { receivedDate: new Date() } : {}),
        ...(next === 'ARCHIVED' ? { archivedAt: new Date() } : {}),
      },
    });
    await tx.oficioTracking.create({
      data: {
        oficioId,
        action: 'STATUS_CHANGED',
        title: `Estado: ${currentStatus} → ${next}`,
        previousData: { status: currentStatus },
        newData: { status: next },
        performedById: actorUserId,
      },
    });
    return tx.oficio.findFirstOrThrow({
      where: oficioScope(organizationId, oficioId),
      include: {
        tracking: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { performedBy: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
  });
}
