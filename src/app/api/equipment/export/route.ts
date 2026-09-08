import type { EquipmentStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { createAuditRecord } from '@/lib/audit';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { canForOrganization } from '@/platform/security/authorization/effective-permissions';
import { apiFailure } from '@/platform/api/response';
import { EQUIPMENT_EXCEL_TYPES } from '@/modules/equipment/import-export/types';
import { buildEquipmentExport } from '@/modules/equipment/import-export/equipment-export';

const STATUSES: EquipmentStatus[] = ['AVAILABLE', 'ASSIGNED', 'IN_MAINTENANCE', 'DAMAGED', 'LOST', 'RETIRED', 'DISPOSED'];

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await requireOrganizationContext(req, requestId);
    if (!await canForOrganization(organization.userId, organization.organizationId, organization.role, 'equipment.read')) {
      return apiFailure('PERMISSION_DENIED', 'No tiene permiso para exportar equipos.', { requestId, status: 403, details: [], stage: 'AUTHORIZE_EQUIPMENT_EXPORT' });
    }
    const search = req.nextUrl.searchParams.get('search')?.trim() || undefined;
    const statusValue = req.nextUrl.searchParams.get('status')?.toUpperCase();
    const typeValue = req.nextUrl.searchParams.get('type')?.toUpperCase();
    if (statusValue && !STATUSES.includes(statusValue as EquipmentStatus)) return apiFailure('INVALID_STATUS', 'Estado inválido.', { requestId, status: 400, details: [], stage: 'VALIDATE_FILTERS' });
    if (typeValue && !EQUIPMENT_EXCEL_TYPES.includes(typeValue as never)) return apiFailure('INVALID_TYPE', 'Tipo inválido.', { requestId, status: 400, details: [], stage: 'VALIDATE_FILTERS' });
    const org = await prisma.organization.findUnique({ where: { id: organization.organizationId }, select: { name: true } });
    const { artifact, exportedRows } = await buildEquipmentExport({ organizationId: organization.organizationId, organizationName: org?.name, search, status: statusValue as EquipmentStatus | undefined, type: typeValue });
    await createAuditRecord({
      title: 'Exportación de inventario de equipos', description: `Se exportaron ${exportedRows} equipos.`, module: 'EQUIPOS', category: 'EXPORT', action: 'EQUIPMENT_EXPORT',
      userId: organization.userId, organizationId: organization.organizationId, requestId,
      metadata: { scope: search || statusValue || typeValue ? 'FILTERED' : 'ALL', exportedRows },
    });
    return new NextResponse(new Uint8Array(artifact.body), { headers: {
      'Content-Type': artifact.contentType, 'Content-Disposition': `attachment; filename="${artifact.filename}"`,
      'Content-Length': String(artifact.body.byteLength), 'Cache-Control': 'no-store', 'x-request-id': requestId,
    } });
  } catch (error) {
    console.error('[EQUIPMENT EXPORT ERROR]', { requestId, error });
    return apiFailure('EQUIPMENT_EXPORT_FAILED', 'No se pudo exportar el inventario.', { requestId, status: 500, details: [], stage: 'EXPORT_EQUIPMENT' });
  }
}

export const GET = withAuth(getHandler);
