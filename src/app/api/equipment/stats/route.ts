import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { getEquipmentStats } from '@/modules/equipment/application/equipment-service';
import { equipmentApiFailure } from '@/modules/equipment/application/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.read');
    const stats = await getEquipmentStats(organizationId);
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error al obtener estadísticas de equipos:', error);
    return equipmentApiFailure(error, requestId, { code: 'EQUIPMENT_STATS_FAILED', message: 'Error al obtener estadísticas', stage: 'LOAD_EQUIPMENT_STATS' });
  }
}

export const GET = withAuth(getHandler);
