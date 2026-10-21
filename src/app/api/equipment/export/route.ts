import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { exportEquipmentInventory, parseEquipmentExportFilters } from '@/modules/equipment/application/equipment-service';
import { apiFailure } from '@/platform/api/response';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'equipment.read');
    const filters = parseEquipmentExportFilters(req.nextUrl.searchParams);
    if ('error' in filters) {
      if (filters.error === 'INVALID_STATUS') {
        return apiFailure('INVALID_STATUS', 'Estado inválido.', { requestId, status: 400, details: [], stage: 'VALIDATE_FILTERS' });
      }
      return apiFailure('INVALID_TYPE', 'Tipo inválido.', { requestId, status: 400, details: [], stage: 'VALIDATE_FILTERS' });
    }
    const { artifact } = await exportEquipmentInventory({
      organizationId: organization.organizationId,
      userId: organization.userId,
      requestId,
      search: filters.search,
      status: filters.status,
      type: filters.type,
    });
    return new NextResponse(new Uint8Array(artifact.body), {
      headers: {
        'Content-Type': artifact.contentType,
        'Content-Disposition': `attachment; filename="${artifact.filename}"`,
        'Content-Length': String(artifact.body.byteLength),
        'Cache-Control': 'no-store',
        'x-request-id': requestId,
      },
    });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    console.error('[EQUIPMENT EXPORT ERROR]', { requestId, error });
    return apiFailure('EQUIPMENT_EXPORT_FAILED', 'No se pudo exportar el inventario.', { requestId, status: 500, details: [], stage: 'EXPORT_EQUIPMENT' });
  }
}

export const GET = withAuth(getHandler);
