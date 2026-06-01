import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

// PATCH - Devolver equipo (cerrar asignación)
async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { returnCondition, notes } = await req.json();

    // Obtener asignación actual
    const assignment = await prisma.equipmentAssignment.findUnique({
      where: { id: params.id },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Asignación no encontrada' },
        { status: 404 }
      );
    }

    if (assignment.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'La asignación ya está cerrada' },
        { status: 400 }
      );
    }

    // Actualizar asignación y estado del equipo
    const result = await prisma.$transaction([
      prisma.equipmentAssignment.update({
        where: { id: params.id },
        data: {
          status: 'RETURNED',
          returnedDate: new Date(),
          notes: returnCondition
            ? `Condición devolución: ${returnCondition}. ${notes || assignment.notes || ''}`
            : (notes || assignment.notes),
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
        where: { id: assignment.equipmentId },
        data: { status: 'AVAILABLE' },
      }),
    ]);

    return NextResponse.json({ assignment: result[0] });
  } catch (error) {
    console.error('Error al devolver equipo:', error);
    return NextResponse.json(
      { error: 'Error al devolver equipo' },
      { status: 500 }
    );
  }
}

export const PATCH = withAuth(patchHandler, ['ADMIN', 'IT']);
