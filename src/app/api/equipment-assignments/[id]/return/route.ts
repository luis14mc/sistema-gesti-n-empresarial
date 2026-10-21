import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { returnEquipmentAssignment } from '@/modules/equipment/application/assignment-service';
import { equipmentApiFailure } from '@/modules/equipment/application/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.assign');
    const { id } = await params;
    const body = await req.json();
    const result = await returnEquipmentAssignment({
      organizationId,
      assignmentId: id,
      returnedById: req.user!.userId,
      body,
    });

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 });
    }
    if (result.kind === 'closed') {
      return NextResponse.json({ error: 'La asignación ya está cerrada' }, { status: 400 });
    }

    return NextResponse.json({ assignment: result.assignment });
  } catch (error) {
    console.error('Error al devolver equipo:', error);
    return equipmentApiFailure(error, requestId, { code: 'ASSIGNMENT_RETURN_FAILED', message: 'Error al devolver equipo', stage: 'RETURN_ASSIGNMENT' });
  }
}

export const PATCH = withAuth(patchHandler);
