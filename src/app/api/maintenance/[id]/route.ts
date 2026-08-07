import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { equipmentApiFailure, maintenanceScope } from '@/modules/equipment/tenant';

const MAINTENANCE_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
const MAINTENANCE_TYPES = ['PREVENTIVE', 'CORRECTIVE', 'UPDATE', 'INSPECTION'] as const;

const VALID_TRANSITIONS: Record<typeof MAINTENANCE_STATUSES[number], readonly typeof MAINTENANCE_STATUSES[number][]> = {
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const maintenanceUpdateSchema = z.object({
  type: z.enum(MAINTENANCE_TYPES).optional(),
  description: z.string().min(1).max(2000).optional(),
  scheduledDate: z.coerce.date().optional().nullable(),
  completedDate: z.coerce.date().optional().nullable(),
  cost: z.coerce.number().nonnegative().optional().nullable(),
  technician: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  status: z.enum(MAINTENANCE_STATUSES).optional(),
});

// GET /api/maintenance/[id] - Obtener mantenimiento por ID
async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const { organizationId } = await requireOrganizationContext(req, requestId);
    const maintenance = await prisma.equipmentMaintenance.findFirst({
      where: { id, ...maintenanceScope(organizationId) },
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
    return equipmentApiFailure(error, requestId, { code: 'MAINTENANCE_GET_FAILED', message: 'Error al obtener mantenimiento', stage: 'GET_MAINTENANCE' });
  }
}

// PATCH /api/maintenance/[id] - Actualizar mantenimiento
async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const { organizationId } = await requireOrganizationContext(req, requestId);
    const data = await req.json();
    const current = await prisma.equipmentMaintenance.findFirst({
      where: { id, ...maintenanceScope(organizationId) },
    });

    if (!current) {
      return NextResponse.json(
        { error: 'Mantenimiento no encontrado' },
        { status: 404 }
      );
    }

    const parsed = maintenanceUpdateSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData = parsed.data;

    // A-5 fix: validar transición de estado si se está modificando.
    if (updateData.status && updateData.status !== current.status) {
      const allowed = VALID_TRANSITIONS[current.status as typeof MAINTENANCE_STATUSES[number]] ?? [];
      if (!allowed.includes(updateData.status as typeof MAINTENANCE_STATUSES[number])) {
        return NextResponse.json(
          { error: `Transición inválida: ${current.status} → ${updateData.status}. Estados terminales (COMPLETED, CANCELLED) no pueden cambiar.` },
          { status: 409 }
        );
      }
    }

    const wasActive = ['SCHEDULED', 'IN_PROGRESS'].includes(current.status);
    const willBeActive = updateData.status
      ? ['SCHEDULED', 'IN_PROGRESS'].includes(updateData.status)
      : wasActive;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.equipmentMaintenance.update({
        where: { id, equipment: { organizationId } },
        data: {
          ...(updateData.type !== undefined && { type: updateData.type }),
          ...(updateData.description !== undefined && { description: updateData.description }),
          ...(updateData.scheduledDate !== undefined && { scheduledDate: updateData.scheduledDate }),
          ...(updateData.completedDate !== undefined && { completedDate: updateData.completedDate }),
          ...(updateData.cost !== undefined && { cost: updateData.cost }),
          ...(updateData.technician !== undefined && { technician: updateData.technician }),
          ...(updateData.notes !== undefined && { notes: updateData.notes }),
          ...(updateData.status !== undefined && { status: updateData.status }),
        },
        include: {
          equipment: { select: { id: true, inventoryCode: true, brand: true, model: true } },
        },
      });

      // A-5 fix: ajustar status del equipo según nueva transición:
      // - Si el mantenimiento pasa a terminal (COMPLETED/CANCELLED) y el equipo
      //   sigue IN_MAINTENANCE, restaurarlo a AVAILABLE.
      // - Si pasa a activo (IN_PROGRESS) y el equipo no está ya en mantenimiento,
      //   ponerlo en IN_MAINTENANCE.
      const isNowActive = ['SCHEDULED', 'IN_PROGRESS'].includes(updated.status);
      if (wasActive && !isNowActive) {
        await tx.equipment.update({
          where: { id: updated.equipmentId, organizationId },
          data: { status: 'AVAILABLE' },
        });
      } else if (!wasActive && isNowActive) {
        await tx.equipment.update({
          where: { id: updated.equipmentId, organizationId },
          data: { status: 'IN_MAINTENANCE' },
        });
      }

      return updated;
    });

    await createAuditRecord({
      title: 'Actualización de mantenimiento',
      description: `Mantenimiento actualizado: ${result.description.substring(0, 50)}`,
      module: 'EQUIPOS',
      category: 'UPDATE',
      userId: req.user!.userId,
      entityId: result.id,
      organizationId,
      previousData: { status: current.status },
      newData: { status: result.status },
    });

    return NextResponse.json({ maintenance: result });
  } catch (error) {
    console.error('Error al actualizar mantenimiento:', error);
    return equipmentApiFailure(error, requestId, { code: 'MAINTENANCE_UPDATE_FAILED', message: 'Error al actualizar mantenimiento', stage: 'UPDATE_MAINTENANCE' });
  }
}

// DELETE /api/maintenance/[id] - Eliminar mantenimiento
async function deleteHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const { organizationId } = await requireOrganizationContext(req, requestId);
    const current = await prisma.equipmentMaintenance.findFirst({
      where: { id, ...maintenanceScope(organizationId) },
    });

    if (!current) {
      return NextResponse.json(
        { error: 'Mantenimiento no encontrado' },
        { status: 404 }
      );
    }

    await prisma.equipmentMaintenance.delete({
      where: { id, equipment: { organizationId } },
    });

    await createAuditRecord({
      title: 'Eliminación de mantenimiento',
      description: 'Mantenimiento eliminado del sistema',
      module: 'EQUIPOS',
      category: 'DELETE',
      userId: req.user!.userId,
      entityId: id,
      organizationId,
      previousData: { type: current.type, description: current.description },
    });

    return NextResponse.json({ message: 'Mantenimiento eliminado' });
  } catch (error) {
    console.error('Error al eliminar mantenimiento:', error);
    return equipmentApiFailure(error, requestId, { code: 'MAINTENANCE_DELETE_FAILED', message: 'Error al eliminar mantenimiento', stage: 'DELETE_MAINTENANCE' });
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler, ['ADMIN', 'IT']);
export const DELETE = withAuth(deleteHandler, ['ADMIN']);
