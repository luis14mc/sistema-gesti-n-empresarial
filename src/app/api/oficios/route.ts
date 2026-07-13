import { NextRequest, NextResponse } from 'next/server';
import { Prisma, OficioType as PrismaOficioType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import {
  formatOficioNumber,
  normalizeOficioDirection,
  normalizeOficioScope,
  parseOficioSequence,
  shouldGenerateOficioNumber,
  type OficioDirection,
  type OficioScope,
} from '@/lib/oficios-numbering';
import { buildMetaScopeFilter } from '@/lib/oficios-meta';
import { parseOficioAttachments } from '@/lib/oficios-attachments';

function buildScopeWhere(scope: OficioScope, direction?: OficioDirection): Prisma.OficioWhereInput {
  if (scope === 'INTERNO') {
    return {
      OR: [{ type: 'INTERNAL_MEMO' }, { scope: 'INTERNO' }],
    };
  }

  if (scope === 'DESPACHO') {
    if (direction === 'INCOMING') {
      return {
        OR: [
          { type: 'INCOMING', scope: 'DESPACHO' },
          { type: 'INCOMING', comments: { contains: buildMetaScopeFilter('DESPACHO') } },
        ],
      };
    }
    if (direction === 'OUTGOING') {
      return { type: 'OUTGOING', number: { startsWith: 'DPICP-' } };
    }
    return {
      OR: [
        { type: 'OUTGOING', number: { startsWith: 'DPICP-' } },
        { type: 'INCOMING', scope: 'DESPACHO' },
        { type: 'INCOMING', comments: { contains: buildMetaScopeFilter('DESPACHO') } },
      ],
    };
  }

  // CNI
  if (direction === 'INCOMING') {
    return {
      OR: [
        { type: 'INCOMING', scope: 'CNI' },
        { type: 'INCOMING', comments: { contains: buildMetaScopeFilter('CNI') } },
      ],
    };
  }
  if (direction === 'OUTGOING') {
    return { type: 'OUTGOING', number: { contains: '-CNI-' } };
  }
  return {
    OR: [
      { type: 'OUTGOING', number: { contains: '-CNI-' } },
      { type: 'INCOMING', scope: 'CNI' },
      { type: 'INCOMING', comments: { contains: buildMetaScopeFilter('CNI') } },
    ],
  };
}

function toPrismaOficioType(direction: OficioDirection): PrismaOficioType {
  return direction as PrismaOficioType;
}

function buildNumberSequenceWhere(params: {
  scope: OficioScope;
  direction: OficioDirection;
  year: number;
}): Prisma.OficioWhereInput {
  const { scope, direction, year } = params;

  if (direction === 'OUTGOING' && scope === 'DESPACHO') {
    return {
      type: 'OUTGOING',
      number: {
        startsWith: 'DPICP-',
        endsWith: `-${year}`,
      },
    };
  }

  if (direction === 'OUTGOING' && scope === 'CNI') {
    return {
      type: 'OUTGOING',
      number: {
        contains: '-CNI-',
        endsWith: `-${year}`,
      },
    };
  }

  return {
    type: 'INTERNAL_MEMO',
    number: {
      startsWith: 'MEMO-',
      endsWith: `-${year}`,
    },
  };
}

async function getNextOficioNumber(tx: Prisma.TransactionClient, params: {
  scope: OficioScope;
  direction: OficioDirection;
  year: number;
}) {
  const lastOficio = await tx.oficio.findFirst({
    where: buildNumberSequenceWhere(params),
    orderBy: { createdAt: 'desc' },
    select: { number: true },
  });

  const nextSequence = lastOficio ? parseOficioSequence(lastOficio.number) + 1 : 1;

  return formatOficioNumber({
    scope: params.scope,
    direction: params.direction,
    sequence: nextSequence,
    year: params.year,
  });
}

// GET - Listar oficios
async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const scopeParam = searchParams.get('scope');
    const directionParam = searchParams.get('direction');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '10'), 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.OficioWhereInput = {};
    const andConditions: Prisma.OficioWhereInput[] = [];

    if (status) where.status = status;

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
        normalizeOficioDirection(directionParam ?? type, undefined)
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
        orderBy: { createdAt: 'desc' },
      }),
      prisma.oficio.count({ where })
    ]);

    return NextResponse.json({
      oficios,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    console.error('Error al obtener oficios:', error);
    return NextResponse.json(
      { error: 'Error al obtener oficios' },
      { status: 500 }
    );
  }
}

// POST - Crear oficio
async function postHandler(req: AuthenticatedRequest) {
  try {
    const {
      subject,
      number,
      externalNumber,
      type,
      direction,
      scope,
      origin,
      recipient,
      institution,
      preparedBy,
      oficioDate,
      receivedDate,
      sentDate,
      attachments,
    } = await req.json();

    const oficioScope = normalizeOficioScope(scope ?? origin);
    const oficioDirection = normalizeOficioDirection(direction ?? type, oficioScope);
    const incomingNumber = (externalNumber ?? number)?.toString().trim();
    const motivo = subject?.toString().trim();
    const destinatario = recipient?.toString().trim();
    const institucion = institution?.toString().trim();
    const elaboradoPor = preparedBy?.toString().trim();

    if (!motivo || !oficioDate) {
      return NextResponse.json(
        { error: 'Motivo y fecha del oficio son requeridos' },
        { status: 400 }
      );
    }

    if (!destinatario) {
      return NextResponse.json(
        { error: 'El destinatario es obligatorio' },
        { status: 400 }
      );
    }

    if (!institucion) {
      return NextResponse.json(
        { error: 'La institución es obligatoria' },
        { status: 400 }
      );
    }

    if (!elaboradoPor) {
      return NextResponse.json(
        { error: 'El campo Elaborado Por es obligatorio' },
        { status: 400 }
      );
    }

    if (oficioDirection === 'INCOMING' && !incomingNumber) {
      return NextResponse.json(
        { error: 'Los oficios ingresados deben registrar el No. de Oficio original' },
        { status: 400 }
      );
    }

    if (!attachments || (Array.isArray(attachments) && attachments.length === 0)) {
      return NextResponse.json(
        { error: 'Es obligatorio adjuntar el documento oficial para crear el oficio' },
        { status: 400 }
      );
    }

    const parsedAttachments = parseOficioAttachments(attachments);
    if (parsedAttachments.length === 0) {
      return NextResponse.json(
        { error: 'El documento adjunto no tiene un formato válido' },
        { status: 400 }
      );
    }

    for (const att of parsedAttachments) {
      if (!att.url?.startsWith('/uploads/oficios/') && !att.url?.startsWith('http')) {
        return NextResponse.json(
          { error: 'URL de documento adjunto no válida' },
          { status: 400 }
        );
      }
    }

    const oficio = await prisma.$transaction(async (tx) => {
      const year = new Date(oficioDate).getFullYear();
      const oficioNumber = shouldGenerateOficioNumber(oficioDirection)
        ? await getNextOficioNumber(tx, {
            scope: oficioScope,
            direction: oficioDirection,
            year,
          })
        : incomingNumber!;

      return tx.oficio.create({
        data: {
          number: oficioNumber,
          subject: motivo,
          scope: oficioScope,
          recipient: destinatario,
          institution: institucion,
          preparedBy: elaboradoPor,
          type: toPrismaOficioType(oficioDirection),
          oficioDate: new Date(oficioDate),
          receivedDate: receivedDate ? new Date(receivedDate) : oficioDirection === 'INCOMING' ? new Date() : undefined,
          sentDate: sentDate ? new Date(sentDate) : oficioDirection === 'OUTGOING' ? new Date(oficioDate) : undefined,
          attachments: parsedAttachments as unknown as Prisma.InputJsonValue,
          createdById: req.user!.userId,
        },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
    });

    await createAuditRecord({
      title: 'Creación de oficio',
      description: `Se creó oficio: ${oficio.number} - ${subject}`,
      module: 'OFICIOS',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: oficio.id,
      newData: {
        number: oficio.number,
        subject,
        scope: oficioScope,
        direction: oficioDirection,
      },
    });

    return NextResponse.json({ oficio }, { status: 201 });
  } catch (error) {
    console.error('Error al crear oficio:', error);
    return NextResponse.json(
      { error: 'Error al crear oficio' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
