import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { resolveEmployeeSnapshot } from '@/lib/employees';
import { logEquipmentHistory, mapReturnConditionToStatus } from '@/lib/equipment-history';
import { mapAssignmentResponse } from '@/lib/equipment-mapper';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { assignmentScope, equipmentApiFailure } from '@/modules/equipment/tenant';
import { isActiveAssignmentConflict } from '@/modules/equipment/assignment-errors';

/** Cambio de equipo: devuelve el anterior y asigna el nuevo en una transacción */
async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await requireOrganizationContext(req, requestId);
    const {
      oldAssignmentId,
      newEquipmentId,
      employeeId,
      userId,
      returnReason,
      returnCondition,
      equipmentStatusAfter,
      deliveryReason,
      assignmentNotes,
      accessories,
    } = await req.json();

    if (!oldAssignmentId || !newEquipmentId) {
      return NextResponse.json(
        { error: 'Asignación anterior y equipo nuevo son requeridos' },
        { status: 400 }
      );
    }

    const oldAssignment = await prisma.equipmentAssignment.findFirst({
      where: { id: oldAssignmentId, ...assignmentScope(organizationId) },
      include: { equipment: true, employee: true, user: true },
    });

    if (!oldAssignment || oldAssignment.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'La asignación anterior no está activa' }, { status: 400 });
    }

    const resolvedEmployeeId = employeeId || oldAssignment.employeeId || undefined;
    const resolvedUserId = userId || oldAssignment.userId || undefined;

    let snapshot;
    try {
      snapshot = await resolveEmployeeSnapshot(organizationId, resolvedEmployeeId, resolvedUserId);
    } catch {
      return NextResponse.json({ error: 'No se pudo resolver el empleado' }, { status: 400 });
    }

    const nextOldStatus = mapReturnConditionToStatus(returnCondition, equipmentStatusAfter);

    const result = await prisma.$transaction(async (tx) => {
      const newEquipment = await tx.equipment.findFirst({
        where: { id: newEquipmentId, organizationId },
        include: { assignments: { where: { status: 'ACTIVE' } } },
      });

      if (!newEquipment) throw new Error('NEW_NOT_FOUND');
      if (newEquipment.status !== 'AVAILABLE' || newEquipment.assignments.length > 0) {
        throw new Error('NEW_NOT_AVAILABLE');
      }

      const closedAssignment = await tx.equipmentAssignment.update({
        where: { id: oldAssignmentId },
        data: {
          status: 'REPLACED',
          returnedDate: new Date(),
          returnedById: req.user!.userId,
          returnReason: returnReason || 'Cambio de equipo',
          returnCondition,
          returnNotes: assignmentNotes,
        },
        include: { equipment: true },
      });

      await tx.equipment.update({
        where: { id: oldAssignment.equipmentId },
        data: { status: nextOldStatus },
      });

      const newAssignment = await tx.equipmentAssignment.create({
        data: {
          equipmentId: newEquipmentId,
          organizationId,
          employeeId: snapshot.employeeId,
          userId: resolvedUserId,
          assignedById: req.user!.userId,
          status: 'ACTIVE',
          departmentAtTime: snapshot.departmentAtTime,
          positionAtTime: snapshot.positionAtTime,
          employeeEmailAtTime: snapshot.employeeEmailAtTime,
          employeeNameAtTime: snapshot.employeeNameAtTime,
          deliveryReason: deliveryReason || 'Cambio de equipo',
          assignmentNotes: [
            assignmentNotes,
            accessories ? `Accesorios: ${accessories}` : null,
          ].filter(Boolean).join('\n') || undefined,
        },
        include: {
          equipment: true,
          employee: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      await tx.equipment.update({
        where: { id: newEquipmentId },
        data: { status: 'ASSIGNED' },
      });

      return { closedAssignment, newAssignment };
    });

    await logEquipmentHistory({
      equipmentId: oldAssignment.equipmentId,
      action: 'REPLACED',
      title: 'Cambio de equipo (devolución)',
      description: `${oldAssignment.equipment.inventoryCode} devuelto por cambio. Estado: ${nextOldStatus}.`,
      performedById: req.user!.userId,
    });

    await logEquipmentHistory({
      equipmentId: newEquipmentId,
      action: 'ASSIGNED',
      title: 'Cambio de equipo (nueva asignación)',
      description: `${result.newAssignment.equipment.inventoryCode} asignado a ${snapshot.employeeNameAtTime} en reemplazo.`,
      performedById: req.user!.userId,
    });

    await createAuditRecord({
      title: 'Cambio de equipo',
      description: `Cambio de ${oldAssignment.equipment.inventoryCode} a ${result.newAssignment.equipment.inventoryCode}`,
      module: 'EQUIPOS',
      category: 'UPDATE',
      userId: req.user!.userId,
      entityId: result.newAssignment.id,
      organizationId,
      newData: {
        oldEquipmentId: oldAssignment.equipmentId,
        newEquipmentId,
        employeeId: snapshot.employeeId,
      },
    });

    return NextResponse.json({
      closedAssignment: mapAssignmentResponse(result.closedAssignment),
      newAssignment: mapAssignmentResponse(result.newAssignment),
    });
  } catch (error: unknown) {
    console.error('Error en cambio de equipo:', error);
    const message = error instanceof Error ? error.message : '';
    if (isActiveAssignmentConflict(error)) {
      return NextResponse.json(
        { error: 'El equipo nuevo ya tiene una asignación activa', code: 'EQUIPMENT_ALREADY_ASSIGNED' },
        { status: 409 },
      );
    }
    if (message === 'NEW_NOT_FOUND') return NextResponse.json({ error: 'Equipo nuevo no encontrado' }, { status: 404 });
    if (message === 'NEW_NOT_AVAILABLE') {
      return NextResponse.json({ error: 'El equipo nuevo no está disponible' }, { status: 400 });
    }
    return equipmentApiFailure(error, requestId, { code: 'ASSIGNMENT_SWAP_FAILED', message: 'Error al realizar cambio de equipo', stage: 'SWAP_ASSIGNMENT' });
  }
}

export const POST = withAuth(postHandler, ['ADMIN', 'IT']);
