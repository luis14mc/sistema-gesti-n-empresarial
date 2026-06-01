import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

// GET - Listar asignaciones
async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const equipmentId = searchParams.get('equipmentId');

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (equipmentId) where.equipmentId = equipmentId;

    const assignments = await prisma.equipmentAssignment.findMany({
      where,
      include: {
        equipment: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { assignedDate: 'desc' },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('Error al obtener asignaciones:', error);
    return NextResponse.json(
      { error: 'Error al obtener asignaciones' },
      { status: 500 }
    );
  }
}

// POST - Crear asignación
async function postHandler(req: AuthenticatedRequest) {
  try {
    const { equipmentId, userId, condition, notes } = await req.json();

    if (!equipmentId || !userId) {
      return NextResponse.json(
        { error: 'ID de equipo y usuario son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el equipo esté disponible
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!equipment) {
      return NextResponse.json(
        { error: 'Equipo no encontrado' },
        { status: 404 }
      );
    }

    if (equipment.assignments.length > 0) {
      return NextResponse.json(
        { error: 'El equipo ya está asignado' },
        { status: 400 }
      );
    }

    // Crear asignación y actualizar estado del equipo
    const result = await prisma.$transaction([
      prisma.equipmentAssignment.create({
        data: {
          equipmentId,
          userId,
          notes: condition ? `Condición: ${condition}. ${notes || ''}` : notes,
          status: 'ACTIVE',
        },
        include: {
          equipment: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.equipment.update({
        where: { id: equipmentId },
        data: { status: 'ASSIGNED' },
      }),
    ]);

    return NextResponse.json({ assignment: result[0] }, { status: 201 });
  } catch (error) {
    console.error('Error al crear asignación:', error);
    return NextResponse.json(
      { error: 'Error al crear asignación' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler, ['ADMIN', 'IT']);
