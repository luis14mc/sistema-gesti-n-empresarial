import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { getEquipmentAssignmentDetail } from '@/modules/equipment/application/assignment-service';
import { equipmentApiFailure } from '@/modules/equipment/application/http';

async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.read');
    const { id } = await params;
    const detail = await getEquipmentAssignmentDetail(id, organizationId);
    if (!detail) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    console.error('Error al obtener asignación:', error);
    return equipmentApiFailure(error, requestId, {
      code: 'ASSIGNMENT_GET_FAILED',
      message: 'Error al obtener la asignación',
      stage: 'GET_ASSIGNMENT',
    });
  }
}

export const GET = withAuth(getHandler);
