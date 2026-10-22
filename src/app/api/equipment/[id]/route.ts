import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/platform/api/with-auth';
import { getEquipment, updateEquipment } from '@/modules/equipment/application/equipment-service';
import { equipmentApiFailure } from '@/modules/equipment/application/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const organization = await authorizeOrganization(req, requestId, 'equipment.read');
    const equipment = await getEquipment(id, organization.organizationId);

    if (!equipment) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ equipment });
  } catch (error) {
    console.error('Error al obtener equipo:', error);
    return equipmentApiFailure(error, requestId, { code: 'EQUIPMENT_GET_FAILED', message: 'Error al obtener equipo', stage: 'GET_EQUIPMENT' });
  }
}

async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const organization = await authorizeOrganization(req, requestId, 'equipment.update');
    const data = await req.json();
    const result = await updateEquipment({
      id,
      organizationId: organization.organizationId,
      userId: req.user!.userId,
      data,
    });

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }
    if (result.kind === 'use_disposal_flow') {
      return NextResponse.json(
        { error: 'Use el flujo de dictamen técnico para dar de baja el equipo.' },
        { status: 409 },
      );
    }

    return NextResponse.json({ equipment: result.equipment });
  } catch (error) {
    console.error('Error al actualizar equipo:', error);
    return equipmentApiFailure(error, requestId, { code: 'EQUIPMENT_UPDATE_FAILED', message: 'Error al actualizar equipo', stage: 'UPDATE_EQUIPMENT' });
  }
}

async function deleteHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    await params;
    await authorizeOrganization(req, requestId, 'equipment.dispose');
    return NextResponse.json(
      { error: 'Use el flujo de dictamen técnico para dar de baja el equipo.' },
      { status: 409 },
    );
  } catch (error) {
    console.error('Error al dar de baja equipo:', error);
    return equipmentApiFailure(error, requestId, { code: 'EQUIPMENT_DELETE_FAILED', message: 'Error al dar de baja equipo', stage: 'DELETE_EQUIPMENT' });
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
