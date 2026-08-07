import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { resolveEmployeeSnapshot } from '@/lib/employees';
import { logEquipmentHistory } from '@/lib/equipment-history';
import { mapAssignmentResponse } from '@/lib/equipment-mapper';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { assignmentScope, equipmentApiFailure } from '@/modules/equipment/tenant';
import { isActiveAssignmentConflict } from '@/modules/equipment/assignment-errors';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await requireOrganizationContext(req, requestId);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const employeeId = searchParams.get('employeeId');
    const equipmentId = searchParams.get('equipmentId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '100');
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = assignmentScope(organizationId);
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (employeeId) where.employeeId = employeeId;
    if (equipmentId) where.equipmentId = equipmentId;

    const [assignments, total] = await Promise.all([
      prisma.equipmentAssignment.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          equipment: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          employee: {
            select: {
              id: true,
              fullName: true,
              email: true,
              department: { select: { name: true } },
              position: { select: { name: true } },
            },
          },
        },
        orderBy: { assignedDate: 'desc' },
      }),
      prisma.equipmentAssignment.count({ where }),
    ]);

    return NextResponse.json({
      assignments: assignments.map(mapAssignmentResponse),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error al obtener asignaciones:', error);
    return equipmentApiFailure(error, requestId, { code: 'ASSIGNMENT_LIST_FAILED', message: 'Error al obtener asignaciones', stage: 'LIST_ASSIGNMENTS' });
  }
}

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await requireOrganizationContext(req, requestId);
    const {
      equipmentId,
      employeeId,
      userId,
      deliveryReason,
      assignmentNotes,
      condition,
      notes,
      accessories,
    } = await req.json();

    if (!equipmentId || (!employeeId && !userId)) {
      return NextResponse.json(
        { error: 'Equipo y empleado son requeridos' },
        { status: 400 }
      );
    }

    let snapshot;
    try {
      snapshot = await resolveEmployeeSnapshot(organizationId, employeeId, userId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ASSIGNEE_ERROR';
      const errors: Record<string, string> = {
        EMPLOYEE_NOT_FOUND: 'Empleado no encontrado',
        EMPLOYEE_INACTIVE: 'El empleado está inactivo',
        EMPLOYEE_NO_EMAIL: 'El empleado no tiene correo registrado',
        USER_NOT_FOUND: 'Usuario no encontrado',
        USER_NOT_FOUND_ORG: 'El usuario no pertenece a esta organización',
        USER_INACTIVE: 'El usuario está inactivo',
        USER_NO_EMAIL: 'El usuario no tiene correo registrado',
        ASSIGNEE_REQUIRED: 'Debe seleccionar un empleado',
      };
      return NextResponse.json({ error: errors[message] || 'Empleado inválido' }, { status: 400 });
    }

    const combinedNotes = [
      assignmentNotes || notes,
      condition ? `Condición de entrega: ${condition}` : null,
      accessories ? `Accesorios: ${accessories}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const result = await prisma.$transaction(async (tx) => {
      const equipment = await tx.equipment.findFirst({
        where: { id: equipmentId, organizationId },
        include: { assignments: { where: { status: 'ACTIVE' } } },
      });

      if (!equipment) throw new Error('NOT_FOUND');
      if (equipment.status !== 'AVAILABLE') throw new Error('NOT_AVAILABLE');
      if (equipment.assignments.length > 0) throw new Error('ALREADY_ASSIGNED');

      const assignment = await tx.equipmentAssignment.create({
        data: {
          equipmentId,
          organizationId,
          employeeId: snapshot.employeeId,
          userId: userId || undefined,
          assignedById: req.user!.userId,
          status: 'ACTIVE',
          departmentAtTime: snapshot.departmentAtTime,
          positionAtTime: snapshot.positionAtTime,
          employeeEmailAtTime: snapshot.employeeEmailAtTime,
          employeeNameAtTime: snapshot.employeeNameAtTime,
          deliveryReason,
          assignmentNotes: combinedNotes || undefined,
          notes: combinedNotes || undefined,
        },
        include: {
          equipment: true,
          employee: {
            select: {
              id: true,
              fullName: true,
              email: true,
              department: { select: { name: true } },
              position: { select: { name: true } },
            },
          },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      await tx.equipment.update({
        where: { id: equipmentId },
        data: { status: 'ASSIGNED' },
      });

      return assignment;
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
      performedById: req.user!.userId,
    });

      await createAuditRecord({
      title: 'Asignación de equipo',
      description: `Se asignó equipo ${result.equipment.inventoryCode} a ${snapshot.employeeNameAtTime}`,
      module: 'EQUIPOS',
      category: 'CREATE',
      userId: req.user!.userId,
       entityId: result.id,
       organizationId,
      newData: {
        equipmentId: result.equipmentId,
        employeeId: snapshot.employeeId,
        equipmentCode: result.equipment.inventoryCode,
      },
    });

    return NextResponse.json({ assignment: mapAssignmentResponse(result) }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error al crear asignación:', error);
    const message = error instanceof Error ? error.message : '';
    // Database-level concurrency guard: the partial unique index rejected a
    // second ACTIVE assignment that raced past the in-transaction pre-check.
    if (isActiveAssignmentConflict(error)) {
      return NextResponse.json(
        { error: 'El equipo ya tiene una asignación activa', code: 'EQUIPMENT_ALREADY_ASSIGNED' },
        { status: 409 },
      );
    }
    if (message === 'NOT_FOUND') return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    if (message === 'NOT_AVAILABLE' || message === 'ALREADY_ASSIGNED') {
      return NextResponse.json({ error: 'El equipo no está disponible para asignación' }, { status: 400 });
    }
    return equipmentApiFailure(error, requestId, { code: 'ASSIGNMENT_CREATE_FAILED', message: 'Error al crear asignación', stage: 'CREATE_ASSIGNMENT' });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler, ['ADMIN', 'IT']);
