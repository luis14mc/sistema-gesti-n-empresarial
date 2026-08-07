import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { logEquipmentHistory, mapReturnConditionToStatus } from '@/lib/equipment-history';
import { mapAssignmentResponse } from '@/lib/equipment-mapper';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { assignmentScope, equipmentApiFailure } from '@/modules/equipment/tenant';

async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await requireOrganizationContext(req, requestId);
    const { id } = await params;
    const {
      returnCondition,
      returnReason,
      returnNotes,
      notes,
      equipmentStatusAfter,
      accessoriesReturned,
      status: assignmentStatus,
    } = await req.json();

    const assignment = await prisma.equipmentAssignment.findFirst({
      where: { id, ...assignmentScope(organizationId) },
      include: { equipment: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 });
    }

    if (assignment.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'La asignación ya está cerrada' }, { status: 400 });
    }

    const nextEquipmentStatus = mapReturnConditionToStatus(returnCondition, equipmentStatusAfter);
    const finalStatus = assignmentStatus === 'REPLACED' ? 'REPLACED' : 'RETURNED';

    const combinedReturnNotes = [
      returnNotes || notes,
      returnCondition ? `Estado físico: ${returnCondition}` : null,
      accessoriesReturned ? `Accesorios devueltos: ${accessoriesReturned}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const result = await prisma.$transaction(async (tx) => {
      const updatedAssignment = await tx.equipmentAssignment.update({
        where: { id, equipment: { organizationId } },
        data: {
          status: finalStatus,
          returnedDate: new Date(),
          returnedById: req.user!.userId,
          returnReason: returnReason || returnCondition,
          returnCondition,
          returnNotes: combinedReturnNotes || undefined,
          notes: combinedReturnNotes || assignment.notes,
        },
        include: {
          equipment: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          employee: {
            select: {
              id: true,
              fullName: true,
              email: true,
              department: { select: { name: true } },
            },
          },
        },
      });

      await tx.equipment.update({
        where: { id: assignment.equipmentId, organizationId },
        data: { status: nextEquipmentStatus },
      });

      return updatedAssignment;
    });

    const historyAction = finalStatus === 'REPLACED' ? 'REPLACED' : 'RETURNED';
    await logEquipmentHistory({
      equipmentId: assignment.equipmentId,
      action: historyAction,
      title: finalStatus === 'REPLACED' ? 'Equipo reemplazado' : 'Equipo devuelto',
      description: `${assignment.equipment.inventoryCode} devuelto. Motivo: ${returnReason || returnCondition || 'No especificado'}. Nuevo estado: ${nextEquipmentStatus}.`,
      previousData: { assignmentStatus: 'ACTIVE', equipmentStatus: assignment.equipment.status },
      newData: { assignmentStatus: finalStatus, equipmentStatus: nextEquipmentStatus, returnReason },
      performedById: req.user!.userId,
    });

    await createAuditRecord({
      title: 'Devolución de equipo',
      description: `Devolución de ${assignment.equipment.inventoryCode}`,
      module: 'EQUIPOS',
      category: 'UPDATE',
      userId: req.user!.userId,
      entityId: id,
      organizationId,
      previousData: { status: 'ACTIVE' },
      newData: { status: finalStatus, returnCondition, equipmentStatus: nextEquipmentStatus },
    });

    return NextResponse.json({ assignment: mapAssignmentResponse(result) });
  } catch (error) {
    console.error('Error al devolver equipo:', error);
    return equipmentApiFailure(error, requestId, { code: 'ASSIGNMENT_RETURN_FAILED', message: 'Error al devolver equipo', stage: 'RETURN_ASSIGNMENT' });
  }
}

export const PATCH = withAuth(patchHandler, ['ADMIN', 'IT']);
