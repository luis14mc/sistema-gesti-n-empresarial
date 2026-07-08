import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';

// GET - Listar oficios
async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (status) where.status = status;
    if (type) where.type = type;

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { number: { contains: search, mode: 'insensitive' } },
        { comments: { contains: search, mode: 'insensitive' } },
      ];
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
    const { subject, type, comments, oficioDate, receivedDate, sentDate, attachments, origin } = await req.json();

    if (!subject || !type || !oficioDate) {
      return NextResponse.json(
        { error: 'Asunto, tipo y fecha del oficio son requeridos' },
        { status: 400 }
      );
    }

    if (!attachments || (Array.isArray(attachments) && attachments.length === 0)) {
      return NextResponse.json(
        { error: 'Es obligatorio subir el documento PDF para crear el oficio' },
        { status: 400 }
      );
    }

    // Usamos una transacción interactiva de Prisma para evitar condiciones de carrera (Race Condition)
    // al generar el número correlativo de oficio.
    const oficio = await prisma.$transaction(async (tx) => {
      // 1. Obtener el último número bajo aislamiento de transacción
      const year = new Date().getFullYear();
      const prefix = origin === 'CNI' ? 'CNI' : 'DPICP';
      const lastOficio = await tx.oficio.findFirst({
        where: { number: { startsWith: `${prefix}-` } },
        orderBy: { number: 'desc' },
      });
      
      let nextNumber = 1;
      if (lastOficio) {
        const parts = lastOficio.number.split('-');
        const lastNum = parseInt(parts[1]);
        if (!isNaN(lastNum)) nextNumber = lastNum + 1;
      }
      const number = `${prefix}-${nextNumber.toString().padStart(3, '0')}-${year}`;

      // 2. Crear el registro
      const newOficio = await tx.oficio.create({
        data: {
          number,
          subject,
          type,
          comments,
          oficioDate: new Date(oficioDate),
          receivedDate: receivedDate ? new Date(receivedDate) : undefined,
          sentDate: sentDate ? new Date(sentDate) : undefined,
          attachments: attachments || [],
          createdById: req.user!.userId,
        },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      return newOficio;
    });

    await createAuditRecord({
      title: 'Creación de oficio',
      description: `Se creó oficio: ${subject}`,
      module: 'OFICIOS',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: oficio.id,
      newData: { number: oficio.number, subject, type },
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
