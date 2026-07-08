import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';

// GET /api/maintenance/[id] - Obtener mantenimiento por ID
async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const maintenance = await prisma.equipmentMaintenance.findUnique({
      where: { id: params.id },
      include: {
        equipment: {
          select: {
            id: true,
            inventoryCode: true,
            brand: true,
            model: true,
            type: true,
            serialNumber: true,
          },
        },
      },
    });

    if (!maintenance) {
      return NextResponse.json(
        { error: 'Mantenimiento no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ maintenance });
  } catch (error) {
    console.error('Error al obtener mantenimiento:', error);
    return NextResponse.json(
      { error: 'Error al obtener mantenimiento' },
      { status: 500 }
    );
  }
}

// PATCH /api/maintenance/[id] - Actualizar mantenimiento
async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await req.json();
    const current = await prisma.equipmentMaintenance.findUnique({
      where: { id: params.id },
    });

    if (!current) {
      return NextResponse.json(
        { error: 'Mantenimiento no encontrado' },
        { status: 404 }
      );
    }

    const allowedFields = [
      'type', 'status', 'description', 'scheduledDate',
      'completedDate', 'cost', 'technician', 'notes',
    ];

    const updateData: any = {};
    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        if (['scheduledDate', 'completedDate'].includes(field) && data[field]) {
          updateData[field] = new Date(data[field]);
        } else {
          updateData[field] = data[field];
        }
      }
    });

    const maintenance = await prisma.equipmentMaintenance.update({
      where: { id: params.id },
      data: updateData,
      include: {
        equipment: {
          select: {
            id: true,
            inventoryCode: true,
            brand: true,
            model: true,
          },
        },
      },
    });

    // Si se completa un mantenimiento correctivo, volver equipo a disponible
    if (
      current.type === 'CORRECTIVE' &&
      current.status === 'IN_PROGRESS' &&
      maintenance.status === 'COMPLETED'
    ) {
      await prisma.equipment.update({
        where: { id: maintenance.equipmentId },
        data: { status: 'AVAILABLE' },
      });
    }

    await createAuditRecord({
      title: 'Actualización de mantenimiento',
      description: `Mantenimiento actualizado: ${maintenance.description.substring(0, 50)}`,
      module: 'EQUIPOS',
      category: 'UPDATE',
      userId: req.user!.userId,
      entityId: maintenance.id,
      previousData: { status: current.status },
      newData: { status: maintenance.status },
    });

    return NextResponse.json({ maintenance });
  } catch (error) {
    console.error('Error al actualizar mantenimiento:', error);
    return NextResponse.json(
      { error: 'Error al actualizar mantenimiento' },
      { status: 500 }
    );
  }
}

// DELETE /api/maintenance/[id] - Eliminar mantenimiento
async function deleteHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const current = await prisma.equipmentMaintenance.findUnique({
      where: { id: params.id },
    });

    if (!current) {
      return NextResponse.json(
        { error: 'Mantenimiento no encontrado' },
        { status: 404 }
      );
    }

    await prisma.equipmentMaintenance.delete({ where: { id: params.id } });

    await createAuditRecord({
      title: 'Eliminación de mantenimiento',
      description: 'Mantenimiento eliminado del sistema',
      module: 'EQUIPOS',
      category: 'DELETE',
      userId: req.user!.userId,
      entityId: params.id,
      previousData: { type: current.type, description: current.description },
    });

    return NextResponse.json({ message: 'Mantenimiento eliminado' });
  } catch (error) {
    console.error('Error al eliminar mantenimiento:', error);
    return NextResponse.json(
      { error: 'Error al eliminar mantenimiento' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler, ['ADMIN', 'IT']);
export const DELETE = withAuth(deleteHandler, ['ADMIN']);