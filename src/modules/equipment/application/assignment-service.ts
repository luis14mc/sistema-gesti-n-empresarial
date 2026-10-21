import { createAuditRecord } from '@/lib/audit';
import { resolveEmployeeSnapshot } from '@/lib/employees';
import { logEquipmentHistory, mapReturnConditionToStatus } from '@/modules/equipment/infrastructure/equipment-history';
import {
  assignEquipmentInTransaction,
  countAssignments,
  findActiveAssignmentForSwap,
  findAssignmentById,
  listAssignments,
  returnAssignmentInTransaction,
  swapAssignmentInTransaction,
  updateAssignmentDocument,
} from '@/modules/equipment/infrastructure/equipment-repository';
import { mapAssignmentResponse } from '@/modules/equipment/presentation/equipment-mapper';
import { assignmentScope } from '@/modules/equipment/application/tenant';
import { isEquipmentDocumentUrlAllowed } from '@/modules/equipment/infrastructure/equipment-attachments';
import { toEquipmentDocumentHref } from '@/modules/equipment/infrastructure/equipment-document-access';
import type { Prisma } from '@prisma/client';

const ASSIGNEE_ERRORS: Record<string, string> = {
  EMPLOYEE_NOT_FOUND: 'Empleado no encontrado',
  EMPLOYEE_INACTIVE: 'El empleado está inactivo',
  EMPLOYEE_NO_EMAIL: 'El empleado no tiene correo registrado',
  USER_NOT_FOUND: 'Usuario no encontrado',
  USER_NOT_FOUND_ORG: 'El usuario no pertenece a esta organización',
  USER_INACTIVE: 'El usuario está inactivo',
  USER_NO_EMAIL: 'El usuario no tiene correo registrado',
  ASSIGNEE_REQUIRED: 'Debe seleccionar un empleado',
};

export async function listEquipmentAssignments(params: {
  organizationId: string;
  searchParams: URLSearchParams;
}) {
  const status = params.searchParams.get('status');
  const userId = params.searchParams.get('userId');
  const employeeId = params.searchParams.get('employeeId');
  const equipmentId = params.searchParams.get('equipmentId');
  const search = params.searchParams.get('search')?.trim();
  const page = parseInt(params.searchParams.get('page') || '1');
  const pageSize = parseInt(params.searchParams.get('pageSize') || '100');
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = assignmentScope(params.organizationId);
  if (status) where.status = status;
  if (userId) where.userId = userId;
  if (employeeId) where.employeeId = employeeId;
  if (equipmentId) where.equipmentId = equipmentId;
  if (search) {
    where.OR = [
      { employeeNameSnapshot: { contains: search, mode: 'insensitive' } },
      { departmentSnapshot: { contains: search, mode: 'insensitive' } },
      { positionSnapshot: { contains: search, mode: 'insensitive' } },
      { inventoryNumberSnapshot: { contains: search, mode: 'insensitive' } },
      { serialNumberSnapshot: { contains: search, mode: 'insensitive' } },
      { brandSnapshot: { contains: search, mode: 'insensitive' } },
      { modelSnapshot: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [assignments, total] = await Promise.all([
    listAssignments(where as Prisma.EquipmentAssignmentWhereInput, skip, pageSize),
    countAssignments(where as Prisma.EquipmentAssignmentWhereInput),
  ]);

  return {
    assignments: assignments.map(mapAssignmentResponse),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function assignEquipment(params: {
  organizationId: string;
  assignedById: string;
  body: {
    equipmentId?: string;
    employeeId?: string;
    userId?: string;
    deliveryReason?: string;
    assignmentNotes?: string;
    condition?: string;
    notes?: string;
    accessories?: string;
  };
}) {
  const {
    equipmentId,
    employeeId,
    userId,
    deliveryReason,
    assignmentNotes,
    condition,
    notes,
    accessories,
  } = params.body;

  if (!equipmentId || (!employeeId && !userId)) {
    return { kind: 'validation' as const, error: 'Equipo y empleado son requeridos' };
  }

  let snapshot;
  try {
    snapshot = await resolveEmployeeSnapshot(params.organizationId, employeeId, userId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ASSIGNEE_ERROR';
    return { kind: 'validation' as const, error: ASSIGNEE_ERRORS[message] || 'Empleado inválido' };
  }

  const combinedNotes = [
    assignmentNotes || notes,
    condition ? `Condición de entrega: ${condition}` : null,
    accessories ? `Accesorios: ${accessories}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const result = await assignEquipmentInTransaction({
      organizationId: params.organizationId,
      equipmentId,
      userId: userId || '',
      assignedById: params.assignedById,
      snapshot: {
        employeeId: snapshot.employeeId,
        departmentAtTime: snapshot.departmentAtTime,
        positionAtTime: snapshot.positionAtTime,
        employeeEmailAtTime: snapshot.employeeEmailAtTime,
        employeeNameAtTime: snapshot.employeeNameAtTime,
      },
      deliveryReason,
      combinedNotes,
    });

    await logEquipmentHistory({
      equipmentId: result.equipmentId,
      action: 'ASSIGNED',
      title: 'Equipo asignado',
      description: `${result.equipment.inventoryCode} asignado a ${snapshot.employeeNameAtTime}, ${snapshot.departmentAtTime}, ${snapshot.positionAtTime}.`,
      newData: {
        assignmentId: result.id,
        employeeName: snapshot.employeeNameAtTime,
        deliveryReason,
      },
      performedById: params.assignedById,
    });

    await createAuditRecord({
      title: 'Asignación de equipo',
      description: `Se asignó equipo ${result.equipment.inventoryCode} a ${snapshot.employeeNameAtTime}`,
      module: 'EQUIPOS',
      category: 'CREATE',
      userId: params.assignedById,
      entityId: result.id,
      organizationId: params.organizationId,
      newData: {
        equipmentId: result.equipmentId,
        employeeId: snapshot.employeeId,
        equipmentCode: result.equipment.inventoryCode,
      },
    });

    return { kind: 'created' as const, assignment: mapAssignmentResponse(result) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NOT_FOUND') return { kind: 'not_found' as const };
    if (message === 'NOT_AVAILABLE' || message === 'ALREADY_ASSIGNED' || message === 'DISPOSAL_IN_PROGRESS') {
      return { kind: 'not_available' as const };
    }
    throw error;
  }
}

export async function returnEquipmentAssignment(params: {
  organizationId: string;
  assignmentId: string;
  returnedById: string;
  body: Record<string, unknown>;
}) {
  const {
    returnCondition,
    returnReason,
    returnNotes,
    notes,
    equipmentStatusAfter,
    accessoriesReturned,
    status: assignmentStatus,
  } = params.body as {
    returnCondition?: string;
    returnReason?: string;
    returnNotes?: string;
    notes?: string;
    equipmentStatusAfter?: string;
    accessoriesReturned?: string;
    status?: string;
  };

  const assignment = await findAssignmentById(params.assignmentId, params.organizationId);
  if (!assignment) return { kind: 'not_found' as const };
  if (assignment.status !== 'ACTIVE') return { kind: 'closed' as const };

  const nextEquipmentStatus = mapReturnConditionToStatus(returnCondition, equipmentStatusAfter);
  const finalStatus = assignmentStatus === 'REPLACED' ? 'REPLACED' : 'RETURNED';

  const combinedReturnNotes = [
    returnNotes || notes,
    returnCondition ? `Estado físico: ${returnCondition}` : null,
    accessoriesReturned ? `Accesorios devueltos: ${accessoriesReturned}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const result = await returnAssignmentInTransaction({
    organizationId: params.organizationId,
    assignmentId: params.assignmentId,
    returnedById: params.returnedById,
    finalStatus,
    nextEquipmentStatus,
    returnReason,
    returnCondition,
    combinedReturnNotes,
    notes: assignment.notes,
  });

  const historyAction = finalStatus === 'REPLACED' ? 'REPLACED' : 'RETURNED';
  await logEquipmentHistory({
    equipmentId: result.equipmentId,
    action: historyAction,
    title: finalStatus === 'REPLACED' ? 'Equipo reemplazado' : 'Equipo devuelto',
    description: `${result.equipmentCode} devuelto. Motivo: ${returnReason || returnCondition || 'No especificado'}. Nuevo estado: ${nextEquipmentStatus}.`,
    previousData: { assignmentStatus: 'ACTIVE', equipmentStatus: result.previousEquipmentStatus },
    newData: { assignmentStatus: finalStatus, equipmentStatus: nextEquipmentStatus, returnReason },
    performedById: params.returnedById,
  });

  await createAuditRecord({
    title: 'Devolución de equipo',
    description: `Devolución de ${result.equipmentCode}`,
    module: 'EQUIPOS',
    category: 'UPDATE',
    userId: params.returnedById,
    entityId: params.assignmentId,
    organizationId: params.organizationId,
    previousData: { status: 'ACTIVE' },
    newData: { status: finalStatus, returnCondition, equipmentStatus: nextEquipmentStatus },
  });

  return { kind: 'ok' as const, assignment: mapAssignmentResponse(result.updatedAssignment) };
}

export async function swapEquipmentAssignment(params: {
  organizationId: string;
  assignedById: string;
  body: Record<string, unknown>;
}) {
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
  } = params.body as {
    oldAssignmentId?: string;
    newEquipmentId?: string;
    employeeId?: string;
    userId?: string;
    returnReason?: string;
    returnCondition?: string;
    equipmentStatusAfter?: string;
    deliveryReason?: string;
    assignmentNotes?: string;
    accessories?: string;
  };

  if (!oldAssignmentId || !newEquipmentId) {
    return { kind: 'validation' as const, error: 'Asignación anterior y equipo nuevo son requeridos' };
  }

  const oldAssignment = await findActiveAssignmentForSwap(oldAssignmentId, params.organizationId);
  if (!oldAssignment || oldAssignment.status !== 'ACTIVE') {
    return { kind: 'old_inactive' as const };
  }

  const resolvedEmployeeId = employeeId || oldAssignment.employeeId || undefined;
  const resolvedUserId = userId || oldAssignment.userId || undefined;

  let snapshot;
  try {
    snapshot = await resolveEmployeeSnapshot(params.organizationId, resolvedEmployeeId, resolvedUserId);
  } catch {
    return { kind: 'validation' as const, error: 'No se pudo resolver el empleado' };
  }

  const nextOldStatus = mapReturnConditionToStatus(returnCondition, equipmentStatusAfter);
  const notesCombined = [
    assignmentNotes,
    accessories ? `Accesorios: ${accessories}` : null,
  ].filter(Boolean).join('\n') || undefined;

  try {
    const result = await swapAssignmentInTransaction({
      organizationId: params.organizationId,
      oldAssignmentId,
      newEquipmentId,
      assignedById: params.assignedById,
      returnedById: params.assignedById,
      snapshot: {
        employeeId: snapshot.employeeId,
        departmentAtTime: snapshot.departmentAtTime,
        positionAtTime: snapshot.positionAtTime,
        employeeEmailAtTime: snapshot.employeeEmailAtTime,
        employeeNameAtTime: snapshot.employeeNameAtTime,
      },
      resolvedUserId,
      nextOldStatus,
      returnReason,
      returnCondition,
      deliveryReason,
      assignmentNotes: notesCombined,
    });

    await logEquipmentHistory({
      equipmentId: result.oldEquipmentId,
      action: 'REPLACED',
      title: 'Cambio de equipo (devolución)',
      description: `${oldAssignment.equipment.inventoryCode} devuelto por cambio. Estado: ${nextOldStatus}.`,
      performedById: params.assignedById,
    });

    await logEquipmentHistory({
      equipmentId: newEquipmentId,
      action: 'ASSIGNED',
      title: 'Cambio de equipo (nueva asignación)',
      description: `${result.newAssignment.equipment.inventoryCode} asignado a ${snapshot.employeeNameAtTime} en reemplazo.`,
      performedById: params.assignedById,
    });

    await createAuditRecord({
      title: 'Cambio de equipo',
      description: `Cambio de ${oldAssignment.equipment.inventoryCode} a ${result.newAssignment.equipment.inventoryCode}`,
      module: 'EQUIPOS',
      category: 'UPDATE',
      userId: params.assignedById,
      entityId: result.newAssignment.id,
      organizationId: params.organizationId,
      newData: {
        oldEquipmentId: oldAssignment.equipmentId,
        newEquipmentId,
        employeeId: snapshot.employeeId,
      },
    });

    return {
      kind: 'ok' as const,
      closedAssignment: mapAssignmentResponse(result.closedAssignment),
      newAssignment: mapAssignmentResponse(result.newAssignment),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NEW_NOT_FOUND') return { kind: 'new_not_found' as const };
    if (message === 'NEW_NOT_AVAILABLE') return { kind: 'new_not_available' as const };
    throw error;
  }
}

export async function attachAssignmentDocument(params: {
  organizationId: string;
  assignmentId: string;
  performedById: string;
  documentType: unknown;
  documentUrl: unknown;
}) {
  if (!params.documentType || !params.documentUrl) {
    return { kind: 'validation' as const, error: 'Tipo y URL del documento son requeridos' };
  }
  if (params.documentType !== 'delivery' && params.documentType !== 'return') {
    return { kind: 'validation' as const, error: 'Tipo de documento inválido' };
  }
  if (!isEquipmentDocumentUrlAllowed(params.documentUrl, params.organizationId)) {
    return { kind: 'invalid_url' as const };
  }

  const storedUrl = toEquipmentDocumentHref(String(params.documentUrl)) ?? String(params.documentUrl);
  const assignment = await findAssignmentById(params.assignmentId, params.organizationId);
  if (!assignment) return { kind: 'not_found' as const };

  const updateData =
    params.documentType === 'return'
      ? { returnDocumentUrl: storedUrl }
      : { deliveryDocumentUrl: storedUrl, urlNotaPdf: storedUrl };

  const updated = await updateAssignmentDocument({
    organizationId: params.organizationId,
    assignmentId: params.assignmentId,
    updateData,
  });

  await logEquipmentHistory({
    equipmentId: assignment.equipmentId,
    action: 'UPDATED',
    title: params.documentType === 'return' ? 'Formato de devolución adjunto' : 'Formato de asignación adjunto',
    description: `Documento firmado registrado para asignación ${params.assignmentId.slice(-8).toUpperCase()}.`,
    newData: { documentType: params.documentType, documentUrl: storedUrl },
    performedById: params.performedById,
  });

  return { kind: 'ok' as const, assignment: mapAssignmentResponse(updated) };
}
