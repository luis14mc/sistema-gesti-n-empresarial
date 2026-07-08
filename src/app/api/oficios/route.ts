import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import {
  formatOficioNumber,
  normalizeOficioDirection,
  normalizeOficioScope,
  parseOficioSequence,
  type OficioDirection,
  type OficioScope,
} from '@/lib/oficios-numbering';

function buildScopeWhere(scope: OficioScope): Prisma.OficioWhereInput {
  if (scope === 'INTERNO') {
    return { type: 'INTERNAL_MEMO' };
  }

  if (scope === 'DESPACHO') {
    return {
      OR: [
        { number: { startsWith: 'DPICP-' } },
        { number: { startsWith: 'ING-DPICP-' } },
      ],
    };
  }

  return {
    OR: [
      { number: { contains: '-CNI-' } },
      { number: { startsWith: 'ING-CNI-' } },
    ],
  };
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

  if (direction === 'INTERNAL_MEMO') {
    return {
      type: 'INTERNAL_MEMO',
      number: {
        startsWith: 'MEMO-',
        endsWith: `-${year}`,
      },
    };
  }

  return {
    type: 'INCOMING',
    number: {
      startsWith: scope === 'DESPACHO' ? 'ING-DPICP-' : 'ING-CNI-',
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
      andConditions.push(buildScopeWhere(scope));
    }

    if (directionParam || type) {
      const scope = scopeParam ? normalizeOficioScope(scopeParam) : undefined;
      where.type = normalizeOficioDirection(directionParam ?? type, scope) as any;
    }

    if (search) {
      andConditions.push({
        OR: [
          { subject: { contains: search, mode: 'insensitive' } },
          { number: { contains: search, mode: 'insensitive' } },
          { comments: { contains: search, mode: 'insensitive' } },
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
      type,
      direction,
      scope,
      origin,
      comments,
      oficioDate,
      receivedDate,
      sentDate,
      attachments,
    } = await req.json();

    const oficioScope = normalizeOficioScope(scope ?? origin);
    const oficioDirection = normalizeOficioDirection(direction ?? type, oficioScope);

    if (!subject || !oficioDate) {
      return NextResponse.json(
        { error: 'Asunto y fecha del oficio son requeridos' },
        { status: 400 }
      );
    }

    if (!attachments || (Array.isArray(attachments) && attachments.length === 0)) {
      return NextResponse.json(
        { error: 'Es obligatorio subir el documento PDF para crear el oficio' },
        { status: 400 }
      );
    }

    const oficio = await prisma.$transaction(async (tx) => {
      const year = new Date(oficioDate).getFullYear();
      const number = await getNextOficioNumber(tx, {
        scope: oficioScope,
        direction: oficioDirection,
        year,
      });

      return tx.oficio.create({
        data: {
          number,
          subject,
          type: oficioDirection as any,
          comments,
          oficioDate: new Date(oficioDate),
          receivedDate: receivedDate ? new Date(receivedDate) : undefined,
          sentDate: sentDate ? new Date(sentDate) : oficioDirection === 'OUTGOING' ? new Date(oficioDate) : undefined,
          attachments: attachments || [],
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
