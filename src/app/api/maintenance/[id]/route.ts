import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/platform/api/with-auth';
import {
  deleteMaintenanceRecord,
  getMaintenanceRecord,
  updateMaintenanceRecord,
} from '@/modules/equipment/application/maintenance-service';
import { equipmentApiFailure } from '@/modules/equipment/application/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.maintain');
    const maintenance = await getMaintenanceRecord(id, organizationId);

    if (!maintenance) {
      return NextResponse.json({ error: 'Mantenimiento no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ maintenance });
  } catch (error) {
    console.error('Error al obtener mantenimiento:', error);
    return equipmentApiFailure(error, requestId, { code: 'MAINTENANCE_GET_FAILED', message: 'Error al obtener mantenimiento', stage: 'GET_MAINTENANCE' });
  }
}

async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.maintain');
    const data = await req.json();
    const result = await updateMaintenanceRecord({
      id,
      organizationId,
      userId: req.user!.userId,
      body: data,
    });

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Mantenimiento no encontrado' }, { status: 404 });
    }
    if (result.kind === 'invalid') {
      return NextResponse.json({ error: 'Datos inválidos', issues: result.issues }, { status: 400 });
    }
    if (result.kind === 'invalid_transition') {
      return NextResponse.json(
        { error: `Transición inválida: ${result.from} → ${result.to}. Estados terminales (COMPLETED, CANCELLED) no pueden cambiar.` },
        { status: 409 },
      );
    }

    return NextResponse.json({ maintenance: result.maintenance });
  } catch (error) {
    console.error('Error al actualizar mantenimiento:', error);
    return equipmentApiFailure(error, requestId, { code: 'MAINTENANCE_UPDATE_FAILED', message: 'Error al actualizar mantenimiento', stage: 'UPDATE_MAINTENANCE' });
  }
}

async function deleteHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.maintain');
    const result = await deleteMaintenanceRecord({
      id,
      organizationId,
      userId: req.user!.userId,
    });

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Mantenimiento no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Mantenimiento eliminado' });
  } catch (error) {
    console.error('Error al eliminar mantenimiento:', error);
    return equipmentApiFailure(error, requestId, { code: 'MAINTENANCE_DELETE_FAILED', message: 'Error al eliminar mantenimiento', stage: 'DELETE_MAINTENANCE' });
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
