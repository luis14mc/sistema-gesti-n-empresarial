import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { swapEquipmentAssignment } from '@/modules/equipment/application/assignment-service';
import { isActiveAssignmentConflict } from '@/modules/equipment/application/assignment-conflict';
import { equipmentApiFailure } from '@/modules/equipment/application/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.assign');
    const body = await req.json();
    const result = await swapEquipmentAssignment({
      organizationId,
      assignedById: req.user!.userId,
      body,
    });

    if (result.kind === 'validation') {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (result.kind === 'old_inactive') {
      return NextResponse.json({ error: 'La asignación anterior no está activa' }, { status: 400 });
    }
    if (result.kind === 'new_not_found') {
      return NextResponse.json({ error: 'Equipo nuevo no encontrado' }, { status: 404 });
    }
    if (result.kind === 'new_not_available') {
      return NextResponse.json({ error: 'El equipo nuevo no está disponible' }, { status: 400 });
    }

    return NextResponse.json({
      closedAssignment: result.closedAssignment,
      newAssignment: result.newAssignment,
    });
  } catch (error: unknown) {
    console.error('Error en cambio de equipo:', error);
    if (isActiveAssignmentConflict(error)) {
      return NextResponse.json(
        { error: 'El equipo nuevo ya tiene una asignación activa', code: 'EQUIPMENT_ALREADY_ASSIGNED' },
        { status: 409 },
      );
    }
    return equipmentApiFailure(error, requestId, { code: 'ASSIGNMENT_SWAP_FAILED', message: 'Error al realizar cambio de equipo', stage: 'SWAP_ASSIGNMENT' });
  }
}

export const POST = withAuth(postHandler);
