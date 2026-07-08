import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { Prisma } from '@prisma/client';

// GET - Listar tickets
async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const assignedToMe = searchParams.get('assignedToMe');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '10'), 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.TicketWhereInput = {};
    const andConditions: Prisma.TicketWhereInput[] = [];

    // RBAC: Prevención de IDOR para rol USER
    if (req.user!.role === 'USER') {
      andConditions.push({
        OR: [
          { createdById: req.user!.userId },
          { assignedToId: req.user!.userId },
        ],
      });
    } else {
      if (status) where.status = status as any;
      if (priority) where.priority = priority as any;
      if (assignedToMe === 'true') where.assignedToId = req.user!.userId;
    }

    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
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
          assignedTo: {
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
      prisma.ticket.count({ where })
    ]);

    return NextResponse.json({
      tickets,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    console.error('Error al obtener tickets:', error);
    return NextResponse.json(
      { error: 'Error al obtener tickets' },
      { status: 500 }
    );
  }
}

// POST - Crear ticket
async function postHandler(req: AuthenticatedRequest) {
  try {
    const { title, description, priority, type, attachments } = await req.json();

    if (!title || !description || !type) {
      return NextResponse.json(
        { error: 'Título, descripción y tipo son requeridos' },
        { status: 400 }
      );
    }

    if (!attachments || (Array.isArray(attachments) && attachments.length === 0)) {
      return NextResponse.json(
        { error: 'Es obligatorio adjuntar una imagen o captura del error' },
        { status: 400 }
      );
    }

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        type,
        attachments: attachments || [],
        createdById: req.user!.userId,
      },
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

    await createAuditRecord({
      title: 'Creación de ticket',
      description: `Se creó ticket: ${title}`,
      module: 'TICKETS',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: ticket.id,
      newData: { title, priority, type },
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error('Error al crear ticket:', error);
    return NextResponse.json(
      { error: 'Error al crear ticket' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
