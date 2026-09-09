import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiFailure } from '@/platform/api/response';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';
import { buildEquipmentTemplate } from '@/modules/equipment/import-export/equipment-template';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    await authorizeOrganization(req, requestId, 'equipment.create');
    const body = await buildEquipmentTemplate();
    return new NextResponse(new Uint8Array(body), { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Plantilla_Inventario_Equipos_CNI.xlsx"',
      'Cache-Control': 'no-store',
      'x-request-id': requestId,
    } });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    console.error('[EQUIPMENT TEMPLATE ERROR]', { requestId, error });
    return apiFailure('EQUIPMENT_TEMPLATE_FAILED', 'No se pudo generar la plantilla.', { requestId, status: 500, details: [], stage: 'GENERATE_TEMPLATE' });
  }
}

export const GET = withAuth(getHandler);
