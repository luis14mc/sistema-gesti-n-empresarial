import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createMaintenanceRecord, listMaintenanceRecords } from '@/modules/equipment/application/maintenance-service';
import { equipmentApiFailure } from '@/modules/equipment/application/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.maintain');
    const result = await listMaintenanceRecords({
      organizationId,
      searchParams: new URL(req.url).searchParams,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al obtener mantenimientos:', error);
    return equipmentApiFailure(error, requestId, { code: 'MAINTENANCE_LIST_FAILED', message: 'Error al obtener mantenimientos', stage: 'LIST_MAINTENANCE' });
  }
}

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.maintain');
    const body = await req.json();
    const result = await createMaintenanceRecord({
      organizationId,
      performedById: req.user!.userId,
      body,
    });

    if (result.kind === 'invalid') {
      return NextResponse.json({ error: 'Datos inválidos', issues: result.issues }, { status: 400 });
    }
    if (result.kind === 'http') {
      return NextResponse.json({ error: result.message, ...result.meta }, { status: result.status });
    }

    return NextResponse.json({ maintenance: result.maintenance }, { status: 201 });
  } catch (error) {
    console.error('Error al crear mantenimiento:', error);
    return equipmentApiFailure(error, requestId, { code: 'MAINTENANCE_CREATE_FAILED', message: 'Error al crear mantenimiento', stage: 'CREATE_MAINTENANCE' });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
