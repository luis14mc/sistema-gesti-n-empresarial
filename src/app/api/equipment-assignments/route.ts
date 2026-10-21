import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { assignEquipment, listEquipmentAssignments } from '@/modules/equipment/application/assignment-service';
import { isActiveAssignmentConflict } from '@/modules/equipment/application/assignment-conflict';
import { equipmentApiFailure } from '@/modules/equipment/application/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.read');
    const result = await listEquipmentAssignments({
      organizationId,
      searchParams: new URL(req.url).searchParams,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al obtener asignaciones:', error);
    return equipmentApiFailure(error, requestId, { code: 'ASSIGNMENT_LIST_FAILED', message: 'Error al obtener asignaciones', stage: 'LIST_ASSIGNMENTS' });
  }
}

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.assign');
    const body = await req.json();
    const result = await assignEquipment({
      organizationId,
      assignedById: req.user!.userId,
      body,
    });

    if (result.kind === 'validation') {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }
    if (result.kind === 'not_available') {
      return NextResponse.json({ error: 'El equipo no está disponible para asignación' }, { status: 400 });
    }

    return NextResponse.json({ assignment: result.assignment }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error al crear asignación:', error);
    if (isActiveAssignmentConflict(error)) {
      return NextResponse.json(
        { error: 'El equipo ya tiene una asignación activa', code: 'EQUIPMENT_ALREADY_ASSIGNED' },
        { status: 409 },
      );
    }
    return equipmentApiFailure(error, requestId, { code: 'ASSIGNMENT_CREATE_FAILED', message: 'Error al crear asignación', stage: 'CREATE_ASSIGNMENT' });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
