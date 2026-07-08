import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';

// GET - Listar asignaciones
async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const equipmentId = searchParams.get('equipmentId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '100');
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (equipmentId) where.equipmentId = equipmentId;

    const [assignments, total] = await Promise.all([
      prisma.equipmentAssignment.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          equipment: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { assignedDate: 'desc' },
      }),
      prisma.equipmentAssignment.count({ where })
    ]);

    return NextResponse.json({ 
      assignments, 
      total, 
      page, 
      pageSize, 
      totalPages: Math.ceil(total / pageSize) 
    });
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

    // Usar transacción interactiva para evitar asignaciones dobles (Race condition)
    const result = await prisma.$transaction(async (tx) => {
      // Verificar que el equipo esté disponible
      const equipment = await tx.equipment.findUnique({
        where: { id: equipmentId },
        include: {
          assignments: {
            where: { status: 'ACTIVE' },
          },
        },
      });

      if (!equipment) {
        throw new Error('NOT_FOUND');
      }

      if (equipment.assignments.length > 0) {
        throw new Error('ALREADY_ASSIGNED');
      }

      // Crear asignación
      const assignment = await tx.equipmentAssignment.create({
        data: {
          equipmentId,
          userId,
          notes: condition ? `Condición: ${condition}. ${notes || ''}` : notes,
          status: 'ACTIVE',
        },
        include: {
          equipment: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      // Actualizar estado del equipo
      await tx.equipment.update({
        where: { id: equipmentId },
        data: { status: 'ASSIGNED' },
      });

      return assignment;
    });

    // Registrar en auditoría (fuera de la transacción para no revertir si falla el log)
    await createAuditRecord({
      title: 'Asignación de equipo',
      description: `Se asignó equipo ${result.equipment.inventoryCode} al usuario ${result.user.firstName} ${result.user.lastName}`,
      module: 'EQUIPOS',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: result.id,
      newData: {
        equipmentId: result.equipmentId,
        userId: result.userId,
        equipmentCode: result.equipment.inventoryCode,
      },
    });

    return NextResponse.json({ assignment: result }, { status: 201 });
  } catch (error: any) {
    console.error('Error al crear asignación:', error);
    
    if (error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }
    if (error.message === 'ALREADY_ASSIGNED') {
      return NextResponse.json({ error: 'El equipo ya está asignado' }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Error al crear asignación' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler, ['ADMIN', 'IT']);
