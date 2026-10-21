import type { Prisma, OficioType as PrismaOficioType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  normalizeOficioDirection,
  normalizeOficioScope,
  shouldGenerateOficioNumber,
  type OficioDirection,
  type OficioScope,
} from '@/modules/oficios/domain/oficios-numbering';
import { allocateOficioNumber } from '@/modules/oficios/infrastructure/numbering';
import {
  oficioDocumentScope,
  oficioScope,
  oficioTenantScope,
  oficioUserAccessScope,
} from '@/modules/oficios/infrastructure/tenant-scope';

function buildScopeWhere(scope: OficioScope, direction?: OficioDirection): Prisma.OficioWhereInput {
  if (scope === 'INTERNO') {
    return {
      OR: [{ type: 'INTERNAL_MEMO' }, { scope: 'INTERNO' }],
    };
  }

  const base: Prisma.OficioWhereInput = { scope };
  if (direction === 'INCOMING') return { ...base, type: 'INCOMING' };
  if (direction === 'OUTGOING') return { ...base, type: 'OUTGOING' };
  return {
    OR: [
      { scope, type: { in: ['INCOMING', 'OUTGOING'] } },
      ...(scope === 'DESPACHO'
        ? [{ type: 'OUTGOING' as const, number: { startsWith: 'DPICP-' } }]
        : [{ type: 'OUTGOING' as const, number: { contains: '-CNI-' } }, { type: 'OUTGOING' as const, number: { startsWith: 'CNI-' } }]),
    ],
  };
}

function toPrismaOficioType(direction: OficioDirection): PrismaOficioType {
  return direction as PrismaOficioType;
}

const listOficioInclude = {
  createdBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  signer: {
    select: { id: true, name: true, positionTitle: true, dependency: true },
  },
  responseTo: {
    select: { id: true, number: true, type: true, subject: true, oficioDate: true, scope: true },
  },
} as const;

export async function listOficios(params: {
  organizationId: string;
  userRole: string;
  userId: string;
  userEmail: string;
  searchParams: URLSearchParams;
}) {
  const { organizationId, userRole, userId, userEmail, searchParams } = params;
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const scopeParam = searchParams.get('scope') ?? searchParams.get('dependency');
  const directionParam = searchParams.get('direction');
  const documentKind = searchParams.get('documentKind');
  const yearParam = searchParams.get('year');
  const recordSource = searchParams.get('recordSource');
  const search = searchParams.get('search');
  const page = Math.max(1, Math.min(parseInt(searchParams.get('page') || '1') || 1, 10_000));
  const pageSize = Math.min(Math.max(1, parseInt(searchParams.get('pageSize') || '10') || 10), 100);
  const skip = (page - 1) * pageSize;

  const where: Prisma.OficioWhereInput = oficioTenantScope(organizationId);
  const andConditions: Prisma.OficioWhereInput[] = [];

  if (userRole === 'USER') {
    andConditions.push(oficioUserAccessScope(userId, userEmail));
  }

  if (status) where.status = status as Prisma.EnumOficioStatusFilter;
  if (recordSource) where.recordSource = recordSource as Prisma.EnumOficioRecordSourceFilter;
  if (documentKind) where.documentKind = documentKind;

  if (yearParam) {
    const year = Number.parseInt(yearParam, 10);
    if (!Number.isNaN(year)) {
      andConditions.push({
        OR: [
          { sequenceYear: year },
          {
            sequenceYear: null,
            oficioDate: {
              gte: new Date(Date.UTC(year, 0, 1)),
              lt: new Date(Date.UTC(year + 1, 0, 1)),
            },
          },
        ],
      });
    }
  }

  if (scopeParam) {
    const scope = normalizeOficioScope(scopeParam);
    const direction = directionParam
      ? normalizeOficioDirection(directionParam, scope)
      : type
        ? normalizeOficioDirection(type, scope)
        : undefined;
    andConditions.push(buildScopeWhere(scope, direction));
  }

  if ((directionParam || type) && !scopeParam) {
    where.type = toPrismaOficioType(
      normalizeOficioDirection(directionParam ?? type, undefined),
    );
  }

  if (search) {
    andConditions.push({
      OR: [
        { subject: { contains: search, mode: 'insensitive' } },
        { number: { contains: search, mode: 'insensitive' } },
        { recipient: { contains: search, mode: 'insensitive' } },
        { institution: { contains: search, mode: 'insensitive' } },
        { preparedBy: { contains: search, mode: 'insensitive' } },
        { senderName: { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const [oficios, total] = await Promise.all([
    prisma.oficio.findMany({
      where,
      skip,
      take: pageSize,
      include: listOficioInclude,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.oficio.count({ where }),
  ]);

  return {
    oficios,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function findOficioByIdDetailed(organizationId: string, id: string) {
  return prisma.oficio.findFirst({
    where: oficioScope(organizationId, id),
    include: {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      importedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      documents: {
        orderBy: [{ isPrimary: 'desc' }, { uploadedAt: 'desc' }],
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      tracking: {
        orderBy: { createdAt: 'asc' },
        include: {
          performedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      signer: {
        select: { id: true, name: true, positionTitle: true, dependency: true },
      },
      responsibleEmployee: {
        select: { id: true, fullName: true, email: true },
      },
      responseTo: {
        select: {
          id: true,
          number: true,
          type: true,
          subject: true,
          oficioDate: true,
          scope: true,
          status: true,
        },
      },
      responses: {
        select: {
          id: true,
          number: true,
          type: true,
          subject: true,
          oficioDate: true,
          scope: true,
          status: true,
        },
        orderBy: { oficioDate: 'asc' },
      },
    },
  });
}

export async function findOficioById(organizationId: string, id: string) {
  return prisma.oficio.findFirst({
    where: oficioScope(organizationId, id),
  });
}

export async function findOficioIdOnly(organizationId: string, id: string) {
  return prisma.oficio.findFirst({
    where: oficioScope(organizationId, id),
    select: { id: true, createdById: true },
  });
}

export async function findRelatedOficioId(organizationId: string, responseToId: string) {
  return prisma.oficio.findFirst({
    where: { id: responseToId, organizationId },
    select: { id: true },
  });
}

export async function findOficioSignerForCreate(
  organizationId: string,
  signerId: string,
) {
  return prisma.oficioSigner.findFirst({
    where: { id: signerId, organizationId },
    select: { id: true, isActive: true, dependency: true },
  });
}

export async function findActiveEmployee(organizationId: string, employeeId: string) {
  return prisma.employee.findFirst({
    where: { id: employeeId, organizationId, isActive: true },
    select: { id: true },
  });
}

export async function createOficioWithTracking(params: {
  organizationId: string;
  actorUserId: string;
  oficioScope: OficioScope;
  oficioDirection: OficioDirection;
  kind: string;
  createInput: Omit<Prisma.OficioUncheckedCreateInput, 'organizationId' | 'number' | 'sequenceYear'>;
  incomingNumber: string;
  year: number;
  responseToId: string | null;
  subject: string;
}) {
  const {
    organizationId,
    actorUserId,
    oficioScope: scope,
    oficioDirection,
    kind,
    createInput,
    incomingNumber,
    year,
    responseToId,
  } = params;

  return prisma.$transaction(async (tx) => {
    let oficioNumber = incomingNumber;
    let sequenceYear: number | null = null;
    let allocatedSequence: number | null = null;

    if (shouldGenerateOficioNumber(oficioDirection)) {
      const allocated = await allocateOficioNumber(tx, {
        organizationId,
        scope,
        direction: oficioDirection,
        year,
      });
      oficioNumber = allocated.documentNumber;
      sequenceYear = allocated.year;
      allocatedSequence = allocated.sequence;
    }

    const created = await tx.oficio.create({
      data: {
        ...createInput,
        organizationId,
        number: oficioNumber,
        sequenceYear,
      } as Prisma.OficioUncheckedCreateInput,
      include: listOficioInclude,
    });

    await tx.oficioTracking.create({
      data: {
        oficioId: created.id,
        action: 'CREATED',
        title:
          oficioDirection === 'INCOMING'
            ? 'Correspondencia de entrada registrada'
            : 'Correspondencia de salida creada',
        description: `Documento ${created.number}`,
        performedById: actorUserId,
        newData: {
          number: created.number,
          direction: oficioDirection,
          dependency: scope,
          documentKind: kind,
          sequence: allocatedSequence,
        },
      },
    });

    if (allocatedSequence != null) {
      await tx.oficioTracking.create({
        data: {
          oficioId: created.id,
          action: 'NUMBER_GENERATED',
          title: 'Número de oficio generado',
          description: created.number,
          performedById: actorUserId,
          newData: { number: created.number, sequence: allocatedSequence, year: sequenceYear },
        },
      });
    }

    if (responseToId) {
      await tx.oficioTracking.create({
        data: {
          oficioId: created.id,
          action: 'RELATIONSHIP_LINKED',
          title: 'Documento relacionado',
          description: 'Vinculado como respuesta/relación',
          performedById: actorUserId,
          newData: { responseToId },
        },
      });
    }

    return created;
  });
}

export async function updateOficioById(params: {
  organizationId: string;
  id: string;
  data: Prisma.OficioUpdateManyMutationInput;
}) {
  await prisma.oficio.updateMany({
    where: oficioScope(params.organizationId, params.id),
    data: params.data,
  });
  return prisma.oficio.findFirstOrThrow({
    where: oficioScope(params.organizationId, params.id),
    include: {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

export async function archiveOficio(organizationId: string, id: string) {
  return prisma.oficio.updateMany({
    where: oficioScope(organizationId, id),
    data: { status: 'ARCHIVED' },
  });
}

export async function createOficioDocument(params: {
  organizationId: string;
  oficioId: string;
  data: Omit<Prisma.OficioDocumentUncheckedCreateInput, 'oficioId'>;
}) {
  return prisma.oficioDocument.create({
    data: {
      ...params.data,
      oficioId: params.oficioId,
    },
  });
}

export async function clearPrimaryOficioDocuments(
  organizationId: string,
  oficioId: string,
  exceptDocumentId: string,
) {
  return prisma.oficioDocument.updateMany({
    where: {
      ...oficioDocumentScope(organizationId, oficioId),
      NOT: { id: exceptDocumentId },
    },
    data: { isPrimary: false },
  });
}

export async function createOficioTrackingEntry(
  data: Prisma.OficioTrackingUncheckedCreateInput,
) {
  return prisma.oficioTracking.create({ data });
}

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
    prisma.oficio.findMany({
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
    prisma.oficio.count({ where }),
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
  return prisma.oficio.findFirst({
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

  return prisma.$transaction(async (tx) => {
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
