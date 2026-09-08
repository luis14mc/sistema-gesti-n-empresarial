import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { canForOrganization } from '@/platform/security/authorization/effective-permissions';
import { apiFailure } from '@/platform/api/response';
import { buildEquipmentTemplate } from '@/modules/equipment/import-export/equipment-template';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await requireOrganizationContext(req, requestId);
    if (!await canForOrganization(organization.userId, organization.organizationId, organization.role, 'equipment.create')) {
      return apiFailure('PERMISSION_DENIED', 'No tiene permiso para importar equipos.', { requestId, status: 403, details: [], stage: 'AUTHORIZE_EQUIPMENT_IMPORT' });
    }
    const body = await buildEquipmentTemplate();
    return new NextResponse(new Uint8Array(body), { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Plantilla_Inventario_Equipos_CNI.xlsx"',
      'Cache-Control': 'no-store',
      'x-request-id': requestId,
    } });
  } catch (error) {
    console.error('[EQUIPMENT TEMPLATE ERROR]', { requestId, error });
    return apiFailure('EQUIPMENT_TEMPLATE_FAILED', 'No se pudo generar la plantilla.', { requestId, status: 500, details: [], stage: 'GENERATE_TEMPLATE' });
  }
}

export const GET = withAuth(getHandler);
